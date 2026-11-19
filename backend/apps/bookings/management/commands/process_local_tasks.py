from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from apps.accounts.tasks import dispatch_notifications
from apps.bookings.tasks import expire_reservations


class Command(BaseCommand):
    help = "Run pending notification and reservation cleanup once during local SQLite development."

    def handle(self, *args, **options):
        if not settings.LOCAL_SQLITE or not settings.CELERY_TASK_ALWAYS_EAGER:
            raise CommandError(
                "This command requires local SQLite with eager tasks. Use Celery beat otherwise."
            )
        expire_reservations()
        dispatch_notifications()
        self.stdout.write(
            self.style.SUCCESS("Local reservation cleanup and notifications processed.")
        )
