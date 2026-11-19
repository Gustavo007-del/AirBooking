from io import StringIO
from unittest.mock import patch

from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings

from apps.accounts.models import User
from apps.flights.models import Airport, Flight


class DemoFlightSetupTests(TestCase):
    @override_settings(DEBUG=True)
    @patch(
        "apps.flights.management.commands.seed_demo_flights.PAIRS",
        [("DEL", "LHR", 540)],
    )
    @patch("apps.flights.airport_import.download_rows")
    def test_combined_setup_imports_airports_and_seeds_flights_once(self, download):
        catalogue = {
            "countries.csv": [{"code": "US", "name": "United States"}],
            "regions.csv": [{"code": "US-CA", "name": "California"}],
            "airports.csv": [
                {
                    "iata_code": "SFO",
                    "scheduled_service": "yes",
                    "type": "large_airport",
                    "name": "San Francisco International Airport",
                    "municipality": "San Francisco",
                    "iso_country": "US",
                    "iso_region": "US-CA",
                    "latitude_deg": "37.61881",
                    "longitude_deg": "-122.37542",
                }
            ],
        }
        download.side_effect = catalogue.__getitem__

        for _ in range(2):
            call_command("setup_demo_flights", stdout=StringIO())
            airport = Airport.objects.get(code="SFO")
            self.assertEqual(
                (airport.region, airport.country), ("California", "United States")
            )
            self.assertEqual(Flight.objects.count(), 120)
            self.assertTrue(
                Flight.objects.filter(
                    origin="DEL", destination="LHR", demonstration=True
                ).exists()
            )
            self.assertFalse(User.objects.exists())

    @override_settings(DEBUG=False)
    @patch("apps.flights.airport_import.download_rows")
    def test_setup_requires_debug_before_downloading(self, download):
        with self.assertRaises(CommandError):
            call_command("setup_demo_flights", stdout=StringIO())
        download.assert_not_called()
        self.assertFalse(Airport.objects.exists())
