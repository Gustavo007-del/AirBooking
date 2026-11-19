import requests
from django.core.management.base import BaseCommand, CommandError
from apps.flights.airport_import import import_airports


class Command(BaseCommand):
    help = "Import scheduled-service airports from OurAirports without creating flights or demo records."

    def handle(self, *args, **options):
        try:
            created = import_airports()
        except (requests.RequestException, ValueError, KeyError) as exc:
            raise CommandError("The OurAirports feed could not be imported.") from exc
        self.stdout.write(
            self.style.SUCCESS(
                f"Imported {created} airports. Existing records preserved."
            )
        )
