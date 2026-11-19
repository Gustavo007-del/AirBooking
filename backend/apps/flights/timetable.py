from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.db import transaction
from django.db.models import Q

from apps.flight_tracking.live import FeedUnavailable, cached_feed
from apps.flight_tracking.providers import aircraft_details
from .models import Airport, Flight, Route


SOURCE = "airlabs_routes"
WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
PAGE_SIZE = 50
FLIGHT_NUMBER = re.compile(r"[A-Z0-9]{2}[0-9]{1,5}[A-Z]?")


def airport_zone(airport):
    # The imported airport catalogue uses UTC as a placeholder.
    if airport.timezone == "UTC":
        return None
    try:
        return ZoneInfo(airport.timezone)
    except (TypeError, ValueError, ZoneInfoNotFoundError):
        return None


def timetable_zone(clock, utc_clock, longitude):
    offset = (clock.hour - utc_clock.hour) * 60 + clock.minute - utc_clock.minute
    offsets = [
        candidate
        for candidate in (offset - 1440, offset, offset + 1440)
        if -720 <= candidate <= 840
    ]
    # Clock times wrap at midnight. Longitude distinguishes the two possible
    # offsets near the date line; the provider's clocks specify the actual time.
    if longitude is None and len(offsets) > 1:
        return None
    approximate_offset = float(longitude or 0) * 4
    return timezone(
        timedelta(
            minutes=min(offsets, key=lambda value: abs(value - approximate_offset))
        )
    )


def timetable_rows(origin, destination):
    params = {"dep_iata": origin, "arr_iata": destination, "limit": PAGE_SIZE}
    rows = []
    for offset in (0, PAGE_SIZE, PAGE_SIZE * 2):
        batch = cached_feed("routes", **params, offset=offset)
        if not isinstance(batch, list):
            raise FeedUnavailable()
        # Stop if the provider repeats a page instead of respecting the offset.
        if batch and batch == rows[-len(batch) :]:
            break
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
    return rows


def timetable_occurrences(rows, airport, destination, start, end, now):
    zone = airport_zone(airport)
    occurrences = {}
    missing_clock = False
    for row in rows:
        if (
            not isinstance(row, dict)
            or row.get("dep_iata") != airport.code
            or row.get("arr_iata") != destination
        ):
            continue
        number = row.get("flight_iata")
        operating_number = row.get("cs_flight_iata")
        if isinstance(operating_number, str) and FLIGHT_NUMBER.fullmatch(
            operating_number
        ):
            number = operating_number
        days = row.get("days")
        if not isinstance(number, str) or not FLIGHT_NUMBER.fullmatch(number):
            continue
        if not isinstance(days, list) or not all(isinstance(day, str) for day in days):
            continue
        minutes = row.get("duration")
        if (
            not isinstance(minutes, int)
            or isinstance(minutes, bool)
            or not 0 < minutes <= 1440
        ):
            continue
        try:
            clock = time.fromisoformat(row["dep_time"])
        except (KeyError, TypeError, ValueError):
            continue
        if clock.tzinfo is not None:
            continue
        row_zone = zone
        if row_zone is None:
            try:
                utc_clock = time.fromisoformat(row["dep_time_utc"])
            except (KeyError, TypeError, ValueError):
                missing_clock = True
                continue
            row_zone = timetable_zone(clock, utc_clock, airport.longitude)
            if row_zone is None:
                missing_clock = True
                continue
        first_day = start.astimezone(row_zone).date()
        last_day = (end - timedelta(microseconds=1)).astimezone(row_zone).date()
        for offset in range((last_day - first_day).days + 1):
            day = first_day + timedelta(days=offset)
            if WEEKDAYS[day.weekday()] not in days:
                continue
            local_departure = datetime.combine(day, clock, tzinfo=row_zone)
            departure = local_departure.astimezone(timezone.utc)
            if departure.astimezone(row_zone).replace(
                tzinfo=None
            ) != local_departure.replace(tzinfo=None):
                continue
            if max(start, now) <= departure < end:
                occurrences.setdefault(
                    (number, departure), (minutes, aircraft_details(row))
                )
    if not occurrences and missing_clock:
        raise FeedUnavailable()
    return occurrences


def flight_inclusions(filters, start, end, now):
    """Return projected departures present in the provider's timetable."""
    if not settings.AIRLABS_API_KEY:
        raise FeedUnavailable()
    origin, destination = filters["origin"], filters["destination"]
    airports = Airport.objects.in_bulk([origin, destination], field_name="code")
    if len(airports) != 2:
        raise FeedUnavailable()
    origin_airport, destination_airport = airports[origin], airports[destination]
    if not origin_airport.active or not destination_airport.active:
        return Q(pk__in=[])
    route = Route.objects.filter(
        origin=origin_airport, destination=destination_airport
    ).first()
    if route and not route.active:
        return Q(pk__in=[])
    rows = timetable_rows(origin, destination)
    if not rows:
        return Q(pk__in=[])
    occurrences = timetable_occurrences(
        rows, origin_airport, destination, start, end, now
    )
    if not occurrences:
        return Q(pk__in=[])
    with transaction.atomic():
        route, _ = Route.objects.get_or_create(
            origin=origin_airport, destination=destination_airport
        )
        if not route.active:
            return Q(pk__in=[])
        seats = settings.AIRLABS_SIMULATION_SEATS
        Flight.objects.bulk_create(
            [
                Flight(
                    number=number,
                    airline=f"Carrier {number[:2]}",
                    airline_code=number[:2],
                    route=route,
                    origin=origin,
                    destination=destination,
                    origin_airport=origin_airport.name,
                    origin_city=origin_airport.city,
                    destination_airport=destination_airport.name,
                    destination_city=destination_airport.city,
                    departure_datetime=departure,
                    arrival_datetime=departure + timedelta(minutes=minutes),
                    price=Decimal(max(2500, minutes * 65)),
                    currency="INR",
                    total_seats=seats,
                    available_seats=seats,
                    status="Scheduled",
                    demonstration=True,
                    schedule_source=SOURCE,
                    aircraft=aircraft,
                )
                for (number, departure), (minutes, aircraft) in occurrences.items()
            ],
            ignore_conflicts=True,
            batch_size=100,
        )
    matches = Q(pk__in=[])
    for number, departure in occurrences:
        matches |= Q(number=number, departure_datetime=departure)
    return matches
