from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError, transaction

DEMO_ACCOUNTS = (
    ("admin@airbooking.test", "Demo Admin", "CloudRun42!", "approved", True),
    ("approved@airbooking.test", "Demo Approved", "BlueWing42!", "approved", False),
    ("pending@airbooking.test", "Demo Pending", "GateHold42!", "pending", False),
)


class Command(BaseCommand):
    help = "Create the three local demo accounts while preserving existing users."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "Demo accounts require DEBUG=true for local development."
            )

        users = get_user_model().objects
        created = 0
        for email, name, password, approval, admin in DEMO_ACCOUNTS:
            existing = users.filter(email__iexact=email)
            if existing.exists():
                continue
            try:
                with transaction.atomic():
                    if admin:
                        users.create_superuser(email, password, name=name)
                    else:
                        users.create_user(
                            email, password, name=name, approval_status=approval
                        )
            except IntegrityError:
                # Another run may have created this email after the lookup.
                if not existing.exists():
                    raise
            else:
                created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Created {created} demo accounts. Skipped {len(DEMO_ACCOUNTS) - created} existing accounts."
            )
        )
