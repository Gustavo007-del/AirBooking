import csv
from decimal import Decimal
from io import StringIO
import re

import requests
from django.db import transaction

from .models import Airport


BASE_URL = "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main"


def download_rows(filename):
    response = requests.get(f"{BASE_URL}/{filename}", timeout=(5, 30))
    response.raise_for_status()
    return csv.DictReader(StringIO(response.content.decode("utf-8-sig")))


def import_airports():
    countries = {row["code"]: row["name"] for row in download_rows("countries.csv")}
    regions = {row["code"]: row["name"] for row in download_rows("regions.csv")}
    catalogue = {}
    for row in download_rows("airports.csv"):
        code = row["iata_code"].strip().upper()
        if (
            row["scheduled_service"] != "yes"
            or row["type"] == "closed"
            or not re.fullmatch("[A-Z]{3}", code)
        ):
            continue
        catalogue.setdefault(
            code,
            Airport(
                code=code,
                name=row["name"][:160],
                city=(row["municipality"] or row["name"])[:100],
                country=countries.get(row["iso_country"], row["iso_country"])[:100],
                region=regions.get(row["iso_region"], "")[:120],
                latitude=Decimal(row["latitude_deg"]),
                longitude=Decimal(row["longitude_deg"]),
            ),
        )
    if not catalogue:
        raise ValueError("OurAirports returned no scheduled-service airports.")
    with transaction.atomic():
        # Preserve existing airport records and their admin-controlled active state.
        existing = dict(Airport.objects.values_list("code", "region"))
        new_airports = [
            airport for code, airport in catalogue.items() if code not in existing
        ]
        Airport.objects.bulk_create(new_airports, ignore_conflicts=True, batch_size=250)
        for code in existing.keys() & catalogue.keys():
            region = catalogue[code].region
            if not existing[code] and region:
                Airport.objects.filter(code=code, region="").update(region=region)
    return len(new_airports)
