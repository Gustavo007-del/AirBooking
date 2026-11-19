from datetime import timedelta
from io import StringIO

from django.core.management import CommandError, call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import Notification, User
from apps.bookings.models import Booking
from apps.flights.models import Airport, Flight, Route


class DemoSeedTests(APITestCase):
    def login(self, email, password):
        self.client.credentials()
        return self.client.post(
            "/api/auth/login/", {"email": email, "password": password}, format="json"
        )

    @override_settings(DEBUG=True)
    def test_seed_accounts_use_existing_login_and_approval_flow(self):
        call_command("seed_demo_data", stdout=StringIO())
        self.assertEqual(User.objects.count(), 3)
        for model in (Notification, Airport, Route, Flight, Booking):
            self.assertFalse(model.objects.exists())

        approved = self.login("approved@airbooking.test", "BlueWing42!")
        self.assertEqual(approved.status_code, 200)
        self.assertEqual(approved.data["user"]["role"], "user")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {approved.data['access']}")
        self.assertEqual(self.client.get("/api/bookings/").status_code, 200)
        self.assertEqual(
            self.client.get(
                "/api/flights/search/",
                {
                    "origin": "BLR",
                    "destination": "DEL",
                    "departure": (timezone.localdate() + timedelta(days=1)).isoformat(),
                },
            ).status_code,
            200,
        )
        self.assertEqual(self.client.get("/api/admin/operations/").status_code, 403)

        pending = User.objects.get(email="pending@airbooking.test")
        blocked = self.login(pending.email, "GateHold42!")
        self.assertEqual(blocked.status_code, 401)
        self.assertIn("pending", blocked.data["detail"])

        admin = self.login("admin@airbooking.test", "CloudRun42!")
        self.assertEqual(admin.status_code, 200)
        self.assertTrue(User.objects.get(email="admin@airbooking.test").is_superuser)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin.data['access']}")
        self.assertEqual(self.client.get("/api/admin/operations/").status_code, 200)
        self.assertEqual(
            self.client.post(f"/api/admin/users/{pending.pk}/approve/").status_code, 200
        )
        call_command("seed_demo_data", stdout=StringIO())
        self.assertEqual(User.objects.count(), 3)
        self.assertEqual(self.login(pending.email, "GateHold42!").status_code, 200)

    @override_settings(DEBUG=True)
    def test_seed_preserves_existing_account_data_on_every_run(self):
        existing = User.objects.create_user(
            "ADMIN@airbooking.test",
            "Unchanged42!",
            name="Existing Customer",
            approval_status="rejected",
        )
        original = User.objects.values().get(pk=existing.pk)
        for _ in range(2):
            call_command("seed_demo_data", stdout=StringIO())
            self.assertEqual(User.objects.count(), 3)
            self.assertEqual(User.objects.values().get(pk=existing.pk), original)

    @override_settings(DEBUG=False)
    def test_seed_refuses_production_settings(self):
        with self.assertRaises(CommandError):
            call_command("seed_demo_data", stdout=StringIO())
        self.assertFalse(User.objects.exists())
