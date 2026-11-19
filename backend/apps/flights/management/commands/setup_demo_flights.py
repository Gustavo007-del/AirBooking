from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Import the airport catalogue and seed sample flights for local testing."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Set DEBUG=true to set up sample flights locally.")

        call_command("import_airports", stdout=self.stdout)
        call_command("seed_demo_flights", confirm_demo=True, stdout=self.stdout)
