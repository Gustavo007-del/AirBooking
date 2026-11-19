from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest import skipUnless
from django.db import connection, close_old_connections
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.exceptions import APIException
from apps.accounts.models import User
from apps.flights.models import Flight
from apps.bookings.services import reserve
from apps.bookings.models import Booking
from apps.payments.models import Payment
from apps.payments.services import simulate


@skipUnless(connection.vendor == "postgresql", "Real PostgreSQL row locks required")
class PostgreSQLConcurrency(TransactionTestCase):
    def setUp(self):
        self.users = [
            User.objects.create_user(
                f"parallel{i}@example.com",
                "test-password",
                name="Parallel",
                approval_status="approved",
            )
            for i in range(2)
        ]
        self.flight = Flight.objects.create(
            number="TEST1",
            airline="Test",
            origin="DEL",
            destination="LHR",
            departure_datetime=timezone.now() + timedelta(days=2),
            arrival_datetime=timezone.now() + timedelta(days=2, hours=8),
            price=100,
            total_seats=1,
            available_seats=1,
        )
        self.data = {
            "flight_ids": [self.flight.pk],
            "cabin": "Economy",
            "passengers": [
                {
                    "first_name": "Parallel",
                    "last_name": "Test",
                    "email": "test@example.com",
                    "birth_date": "1990-01-01",
                }
            ],
        }

    def run_parallel(self, operation):
        barrier = Barrier(2)

        def job(i):
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                return operation(i)
            except APIException as error:
                return error.status_code
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(job, range(2)))

    def test_last_seat_has_single_winner(self):
        results = self.run_parallel(
            lambda i: reserve(self.users[i], self.data, f"request-{i}")[1]
        )
        self.assertEqual(results.count(True), 1)
        self.assertEqual(results.count(409), 1)
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 0)
        self.assertEqual(Booking.objects.count(), 1)

    def test_duplicate_request_creates_one_booking(self):
        results = self.run_parallel(
            lambda i: str(reserve(self.users[0], self.data, "same-key")[0].pk)
        )
        self.assertEqual(results[0], results[1])
        self.assertEqual(Booking.objects.count(), 1)

    def test_parallel_payment_has_one_transaction(self):
        booking, _ = reserve(self.users[0], self.data, "payment-key")
        self.run_parallel(lambda i: simulate(booking.pk, "success"))
        self.assertEqual(Payment.objects.count(), 1)
        booking.refresh_from_db()
        self.assertEqual(booking.status, "Confirmed")
