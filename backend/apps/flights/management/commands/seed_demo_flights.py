from datetime import timedelta
from decimal import Decimal
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from apps.flights.models import Airport, Route, Flight
from apps.flights.services import create_flight

AIRPORTS = [
    ("DEL", "Indira Gandhi International", "New Delhi", "India", "Asia/Kolkata"),
    (
        "BOM",
        "Chhatrapati Shivaji Maharaj International",
        "Mumbai",
        "India",
        "Asia/Kolkata",
    ),
    ("BLR", "Kempegowda International", "Bengaluru", "India", "Asia/Kolkata"),
    ("HYD", "Rajiv Gandhi International", "Hyderabad", "India", "Asia/Kolkata"),
    ("MAA", "Chennai International", "Chennai", "India", "Asia/Kolkata"),
    (
        "CCU",
        "Netaji Subhas Chandra Bose International",
        "Kolkata",
        "India",
        "Asia/Kolkata",
    ),
    ("LHR", "Heathrow", "London", "United Kingdom", "Europe/London"),
    ("DXB", "Dubai International", "Dubai", "United Arab Emirates", "Asia/Dubai"),
    ("SIN", "Changi", "Singapore", "Singapore", "Asia/Singapore"),
    ("DPS", "Ngurah Rai International", "Bali", "Indonesia", "Asia/Makassar"),
    ("NRT", "Narita International", "Tokyo", "Japan", "Asia/Tokyo"),
    ("ZRH", "Zurich Airport", "Zurich", "Switzerland", "Europe/Zurich"),
    ("CDG", "Charles de Gaulle", "Paris", "France", "Europe/Paris"),
    (
        "JFK",
        "John F. Kennedy International",
        "New York",
        "United States",
        "America/New_York",
    ),
]
PAIRS = [
    ("DEL", "LHR", 540),
    ("DEL", "BOM", 130),
    ("BOM", "DXB", 190),
    ("BLR", "SIN", 270),
    ("DEL", "DPS", 440),
    ("DEL", "NRT", 510),
    ("DEL", "ZRH", 520),
    ("BOM", "CDG", 570),
    ("DEL", "JFK", 910),
    ("BOM", "HYD", 100),
    ("BLR", "MAA", 60),
    ("DEL", "CCU", 135),
]


class Command(BaseCommand):
    help = (
        "Seed airport reference data, routes and clearly marked demonstration flights."
    )

    def add_arguments(self, parser):
        parser.add_argument("--confirm-demo", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        if not options["confirm_demo"] or not settings.DEBUG:
            raise CommandError(
                "Set DEBUG=true and pass --confirm-demo to seed demonstration inventory."
            )
        airports = {}
        for code, name, city, country, zone in AIRPORTS:
            airports[code], _ = Airport.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "city": city,
                    "country": country,
                    "timezone": zone,
                },
            )
        base = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        created = 0
        for index, (origin, destination, duration) in enumerate(PAIRS):
            for direction, (start, end) in enumerate(
                [(origin, destination), (destination, origin)]
            ):
                route, _ = Route.objects.get_or_create(
                    origin=airports[start],
                    destination=airports[end],
                    defaults={"duration_minutes": duration},
                )
                if (
                    not route.active
                    or not route.origin.active
                    or not route.destination.active
                ):
                    continue
                for day in range(1, 31):
                    for slot, hour in enumerate((8, 17)):
                        number = f"AB{100 + index * 4 + direction * 2 + slot}"
                        departure = base + timedelta(days=day, hours=hour)
                        if Flight.objects.filter(
                            number=number, departure_datetime=departure
                        ).exists():
                            continue
                        fare = Decimal(
                            1800 + duration * 65 + slot * 1900 + (day % 5) * 350
                        )
                        create_flight(
                            {
                                "route": route,
                                "number": number,
                                "airline": [
                                    "Air Booking Pacific",
                                    "Air Booking Atlantic",
                                ][slot],
                                "departure_datetime": departure,
                                "arrival_datetime": departure
                                + timedelta(minutes=duration),
                                "price": fare,
                                "total_seats": 18 + (day % 7) * 6,
                                "status": [
                                    "Scheduled",
                                    "On time",
                                    "Delayed",
                                    "Cancelled",
                                ][day % 19 % 4]
                                if day % 19 < 4
                                else "Scheduled",
                                "demonstration": True,
                            }
                        )
                        created += 1
        self.stdout.write(
            self.style.SUCCESS(
                f"Airport catalogue ready. Created {created} demonstration flights."
            )
        )
