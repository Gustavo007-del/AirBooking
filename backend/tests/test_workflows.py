import uuid
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from django.test import override_settings
from django.core.cache import cache
from django.core import mail
from django.utils import timezone
from rest_framework.test import APITestCase
from apps.accounts.models import User, Notification
from apps.accounts.tasks import send_notification
from apps.flights.models import Airport, Flight, Route
from apps.bookings.models import Booking
from apps.bookings.services import expire
from apps.payments.models import Payment
from apps.flight_tracking.providers import AirLabsProvider

PASSWORD = "Str0ng-flight-test-password!"


class Workflows(APITestCase):
    @override_settings(AIRLABS_API_KEY="test-only", AIRLABS_SIMULATION_SEATS=3)
    @patch("apps.flights.timetable.timetable_rows")
    def test_airlabs_timetable_search_uses_shared_simulation_inventory(self, provider):
        origin = Airport.objects.create(
            code="DEL", name="Delhi", city="Delhi", timezone="Asia/Kolkata"
        )
        Airport.objects.create(
            code="LHR", name="Heathrow", city="London", timezone="Europe/London"
        )
        weekday = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")[
            self.departure.weekday()
        ]
        expected = {
            "flight_iata": "BA178",
            "dep_iata": origin.code,
            "arr_iata": "LHR",
            "dep_time": "15:00",
            "days": [weekday],
            "duration": 480,
        }
        provider.return_value = [
            expected,
            {**expected, "flight_iata": "BA180", "days": []},
        ]
        query = {
            "origin": "DEL",
            "destination": "LHR",
            "departure": self.departure.date().isoformat(),
        }
        first = self.client.get("/api/flights/search/", query)
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(first.data["source"], "airlabs_routes")
        self.assertEqual(first.data["count"], 1)
        flight = first.data["results"][0]
        self.assertEqual(flight["number"], "BA178")
        self.assertEqual(flight["departure"], "09:30")
        self.assertEqual(flight["schedule_source"], "airlabs_routes")
        self.assertTrue(flight["demonstration"])
        booking = self.reserve([flight["id"]])
        self.assertEqual(booking.status_code, 201, booking.data)
        self.assertEqual(
            self.pay(booking.data["id"]).data["paymentStatus"], "Simulated"
        )
        again = self.client.get("/api/flights/search/", query).data["results"][0]
        self.assertEqual((again["id"], again["seats"]), (flight["id"], 2))
        provider.return_value = []
        empty = self.client.get("/api/flights/search/", query).data
        self.assertEqual((empty["source"], empty["count"]), ("airlabs_routes", 0))
        from apps.flight_tracking.live import FeedUnavailable

        provider.side_effect = FeedUnavailable()
        fallback = self.client.get("/api/flights/search/", query).data
        self.assertEqual(fallback["source"], "database")
        self.assertIn(self.flight.number, [f["number"] for f in fallback["results"]])

    @override_settings(AIRLABS_API_KEY="test-only")
    @patch("apps.flight_tracking.live.airlabs_request")
    def test_imported_airport_uses_provider_clocks_across_midnight(self, provider):
        Airport.objects.create(code="PNQ", name="Pune", city="Pune", longitude=73.92)
        Airport.objects.create(code="LHR", name="Heathrow", city="London")
        utc_day = self.departure.date()
        origin_day = utc_day + timedelta(days=1)
        operating = {
            "flight_iata": "BA178",
            "dep_iata": "PNQ",
            "arr_iata": "LHR",
            "dep_time": "02:00",
            "dep_time_utc": "20:30",
            "days": [
                ("mon", "tue", "wed", "thu", "fri", "sat", "sun")[origin_day.weekday()]
            ],
            "duration": 480,
        }
        provider.return_value = [
            {**operating, "flight_iata": "AC123", "cs_flight_iata": "BA178"},
            operating,
        ]
        results = self.client.get(
            "/api/flights/search/",
            {"origin": "PNQ", "destination": "LHR", "departure": utc_day.isoformat()},
        ).data
        self.assertEqual((results["source"], results["count"]), ("airlabs_routes", 1))
        self.assertEqual(results["results"][0]["departure"], "20:30")
        self.assertEqual(results["results"][0]["number"], "BA178")
        provider.assert_called_once_with(
            "routes", dep_iata="PNQ", arr_iata="LHR", limit=50, offset=0
        )

    def test_edit_pending_booking_and_delete_releases_seats_once(self):
        reservation = self.reserve()
        path = f"/api/bookings/{reservation.data['id']}/"
        edited = {**self.passengers[0], "firstName": "Corrected"}
        response = self.client.patch(path, {"passengers": [edited]}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["passengers"][0]["firstName"], "Corrected")
        self.assertEqual(response.data["total_price"], reservation.data["total_price"])
        self.assertEqual(
            self.client.patch(
                path, {"passengers": [edited, edited]}, format="json"
            ).status_code,
            400,
        )
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.delete(path).status_code, 404)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.delete(path).status_code, 204)
        self.assertEqual(self.client.delete(path).status_code, 204)
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 3)
        self.assertEqual(self.client.get(path).data["status"], "Cancelled")

    @override_settings(AIRLABS_API_KEY="test-key")
    @patch("apps.flight_tracking.live.airlabs_request")
    def test_external_flights_are_read_only_and_schedule_is_filtered(self, upstream):
        live_departure = timezone.now() + timedelta(hours=1)
        item = {
            "flight_iata": "BA178",
            "dep_iata": "DEL",
            "arr_iata": "LHR",
            "dep_time_ts": live_departure.timestamp(),
            "arr_time_ts": (live_departure + timedelta(hours=8)).timestamp(),
            "status": "scheduled",
            "model": "Boeing 787",
        }
        upstream.side_effect = [item, [item, item, {**item, "arr_iata": "JFK"}]]
        live = self.client.get("/api/flights/live-status/", {"number": "BA178"})
        self.assertEqual(live.status_code, 200)
        self.assertEqual(live.data["aircraft"]["model"], "Boeing 787")
        future_search = {
            "origin": "DEL",
            "destination": "LHR",
            "departure": self.departure.date().isoformat(),
        }
        outside = self.client.get("/api/flights/schedules/", future_search)
        self.assertEqual(outside.status_code, 200)
        self.assertTrue(outside.data["outside_window"])
        self.assertEqual(upstream.call_count, 1)
        schedule = self.client.get(
            "/api/flights/schedules/", {**future_search, "upcoming": True}
        )
        self.assertEqual(schedule.status_code, 200)
        self.assertFalse(schedule.data["outside_window"])
        upstream.assert_called_with(
            "schedules", dep_iata="DEL", arr_iata="LHR", limit=50
        )
        self.assertEqual(len(schedule.data["results"]), 1)
        self.assertNotIn("price", schedule.data["results"][0])
        self.assertEqual(Flight.objects.count(), 2)
        selection = self.client.get(
            "/api/flights/schedules/",
            {**future_search, "departure": live_departure.date().isoformat()},
        )
        self.assertEqual(len(selection.data["results"]), 1)
        self.assertEqual(upstream.call_count, 2)

    def test_browser_session_rotates_cookie_and_logs_out(self):
        self.client.force_authenticate(None)
        login = self.client.post(
            "/api/auth/login/",
            {
                "email": self.user.email,
                "password": PASSWORD,
            },
            HTTP_X_AIR_SESSION="1",
        )
        self.assertEqual(login.status_code, 200)
        cookie = login.cookies["air_booking_session"]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["samesite"], "Strict")
        refreshed = self.client.post("/api/auth/session/", HTTP_X_AIR_SESSION="1")
        self.assertEqual(refreshed.status_code, 200)
        self.assertEqual(refreshed.data["user"]["id"], str(self.user.pk))
        self.assertNotEqual(
            refreshed.cookies["air_booking_session"].value, cookie.value
        )
        self.assertEqual(
            self.client.delete(
                "/api/auth/session/", HTTP_X_AIR_SESSION="1"
            ).status_code,
            204,
        )
        self.assertEqual(
            self.client.post("/api/auth/session/", HTTP_X_AIR_SESSION="1").status_code,
            204,
        )

    def test_catalogue_filters_inactive_routes_and_blocks_new_reservations(self):
        self.client.force_authenticate(self.admin)
        origin = self.client.post(
            "/api/admin/airports/",
            {
                "code": "DEL",
                "name": "Delhi Airport",
                "city": "New Delhi",
                "country": "India",
            },
            format="json",
        ).data["id"]
        destination = self.client.post(
            "/api/admin/airports/",
            {
                "code": "LHR",
                "name": "London Heathrow",
                "city": "London",
                "country": "United Kingdom",
                "region": "England",
            },
            format="json",
        ).data["id"]
        invalid = self.client.post(
            "/api/admin/routes/", {"origin": origin, "destination": origin}
        )
        self.assertEqual(invalid.status_code, 400)
        created = self.client.post(
            "/api/admin/routes/",
            {"origin": origin, "destination": destination},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.flight.route_id = created.data["id"]
        self.flight.save(update_fields=["route"])
        self.assertEqual(
            self.client.get("/api/airports/?search=heathrow").data["count"], 1
        )
        self.assertEqual(
            self.client.get("/api/airports/?search=england").data["count"], 1
        )
        self.assertEqual(
            self.client.get("/api/airports/?search=united+kingdom").data["count"], 1
        )
        self.assertEqual(self.client.get("/api/destinations/").data["count"], 1)
        self.assertEqual(
            self.client.get("/api/admin/dashboard/").data["active_routes"], 1
        )
        self.assertEqual(
            self.client.patch(
                f"/api/admin/routes/{created.data['id']}/", {"active": False}
            ).status_code,
            200,
        )
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get("/api/destinations/").data["count"], 0)
        self.assertEqual(self.reserve().status_code, 409)
        self.assertEqual(self.client.post("/api/admin/routes/", {}).status_code, 403)

    def test_registration_exposes_password_validation_without_internal_keys(self):
        self.client.force_authenticate(None)
        response = self.client.post(
            "/api/auth/register/",
            {
                "name": "Test Traveller",
                "email": "uniquephrase@example.com",
                "password": "uniquephrase",
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data["errors"])
        self.assertIn("similar", response.data["detail"])
        self.assertNotIn("non_field_errors", response.data["detail"])
        self.assertFalse(User.objects.filter(email="uniquephrase@example.com").exists())

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            "traveller@example.com",
            PASSWORD,
            name="Traveller Test",
            approval_status="approved",
        )
        self.other = User.objects.create_user(
            "other@example.com", PASSWORD, name="Other Test", approval_status="approved"
        )
        self.admin = User.objects.create_superuser(
            "admin@example.com", PASSWORD, name="Admin Test"
        )
        self.departure = (timezone.now() + timedelta(days=7)).replace(
            hour=9, minute=0, second=0, microsecond=0
        )
        self.flight = self.make_flight("AB101", "DEL", "LHR", self.departure)
        self.back = self.make_flight(
            "AB102", "LHR", "DEL", self.departure + timedelta(days=7)
        )
        self.passengers = [
            {
                "firstName": "Taylor",
                "lastName": "Example",
                "email": "traveller@example.com",
                "birthDate": "1990-01-01",
            }
        ]
        self.client.force_authenticate(self.user)

    def make_flight(self, number, origin, destination, departure, seats=3):
        return Flight.objects.create(
            number=number,
            airline="Test Airline",
            origin=origin,
            destination=destination,
            departure_datetime=departure,
            arrival_datetime=departure + timedelta(hours=8),
            price=Decimal("100.00"),
            total_seats=seats,
            available_seats=seats,
            status="On time",
        )

    def reserve(self, ids=None, key=None, **extra):
        return self.client.post(
            "/api/bookings/",
            {
                "flight_ids": ids or [str(self.flight.pk)],
                "passengers": self.passengers,
                **extra,
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY=key or str(uuid.uuid4()),
        )

    def pay(self, pk, outcome="success"):
        return self.client.post(
            f"/api/bookings/{pk}/payment/", {"outcome": outcome}, format="json"
        )

    def test_registration_accepts_eight_character_passwords(self):
        self.client.force_authenticate(None)
        account = {"name": "New Traveller", "email": "length-test@example.com"}
        short = self.client.post(
            "/api/auth/register/", {**account, "password": "xF4!2zQ"}, format="json"
        )
        self.assertEqual(short.status_code, 400, short.data)
        valid = self.client.post(
            "/api/auth/register/", {**account, "password": "xF4!2zQp"}, format="json"
        )
        self.assertEqual(valid.status_code, 201, valid.data)

    def test_registration_approval_jwt_and_email(self):
        self.client.force_authenticate(None)
        payload = {
            "name": "New Traveller",
            "email": "NEW@example.com",
            "password": PASSWORD,
        }
        response = self.client.post("/api/auth/register/", payload)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], "pending")
        self.assertNotIn("password", response.data)
        user = User.objects.get(email="new@example.com")
        self.assertTrue(user.check_password(PASSWORD))
        credentials = {"email": "new@example.com", "password": PASSWORD}
        self.assertEqual(
            self.client.post("/api/auth/login/", credentials).status_code, 401
        )
        self.client.force_authenticate(self.admin)
        with patch("apps.accounts.tasks.send_notification.apply_async") as queued:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(f"/api/admin/users/{user.pk}/approve/")
            self.assertEqual(response.status_code, 200)
            queued.assert_called_once()
        notification = Notification.objects.get(user=user)
        send_notification(str(notification.pk))
        send_notification(str(notification.pk))
        self.assertEqual(len(mail.outbox), 1)
        self.client.force_authenticate(None)
        response = self.client.post("/api/auth/login/", credentials)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["user"]["role"], "user")
        token = response.data
        self.assertEqual(
            self.client.post(
                "/api/auth/token/refresh/", {"refresh": token["refresh"]}
            ).status_code,
            401,
        )
        self.client.force_authenticate(self.other)
        self.assertEqual(
            self.client.post(
                "/api/auth/token/refresh/", {"refresh": token["refresh"]}
            ).status_code,
            401,
        )
        self.client.force_authenticate(None)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + token["access"])
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 200)
        refresh = self.client.post(
            "/api/auth/token/refresh/", {"refresh": token["refresh"]}
        )
        self.assertEqual(refresh.status_code, 200, refresh.data)
        self.assertNotEqual(refresh.data["refresh"], token["refresh"])
        self.assertEqual(
            self.client.post(
                "/api/auth/token/refresh/", {"refresh": token["refresh"]}
            ).status_code,
            401,
        )
        self.assertEqual(
            self.client.post(
                "/api/auth/logout/", {"refresh": refresh.data["refresh"]}
            ).status_code,
            204,
        )
        self.assertEqual(
            self.client.post(
                "/api/auth/token/refresh/", {"refresh": refresh.data["refresh"]}
            ).status_code,
            401,
        )

    def test_registration_validation_and_privilege_injection(self):
        self.client.force_authenticate(None)
        response = self.client.post(
            "/api/auth/register/",
            {"email": "x@example.com", "name": "New", "password": "123"},
        )
        self.assertEqual(response.status_code, 400)
        response = self.client.post(
            "/api/auth/register/",
            {"email": "TRAVELLER@example.com", "name": "New", "password": PASSWORD},
        )
        self.assertEqual(response.status_code, 400)
        response = self.client.post(
            "/api/auth/register/",
            {
                "email": "safe@example.com",
                "name": "Safe",
                "password": PASSWORD,
                "is_staff": True,
                "approval_status": "approved",
            },
        )
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(pk=response.data["id"])
        self.assertFalse(user.is_staff)
        self.assertEqual(user.approval_status, "pending")

    def test_revoked_approval_blocks_access_and_refresh(self):
        self.client.force_authenticate(None)
        token = self.client.post(
            "/api/auth/login/", {"email": self.user.email, "password": PASSWORD}
        ).data
        self.user.approval_status = "rejected"
        self.user.save()
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + token["access"])
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)
        self.assertEqual(
            self.client.post(
                "/api/auth/token/refresh/", {"refresh": token["refresh"]}
            ).status_code,
            401,
        )

    def test_admin_permissions_and_rejection(self):
        self.assertEqual(self.client.get("/api/admin/users/").status_code, 403)
        self.assertEqual(
            self.client.post(f"/api/admin/users/{self.other.pk}/approve/").status_code,
            403,
        )
        self.assertEqual(self.client.post("/api/admin/flights/", {}).status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(
            self.client.post(f"/api/admin/users/{self.other.pk}/reject/").status_code,
            200,
        )
        self.other.refresh_from_db()
        self.assertEqual(self.other.approval_status, "rejected")
        self.assertEqual(
            self.client.get("/api/admin/users/?approval_status=rejected").data["count"],
            1,
        )

    def test_search_and_detail_match_frontend(self):
        self.client.force_authenticate(None)
        query = {
            "origin": "DEL",
            "destination": "LHR",
            "departure": self.departure.date().isoformat(),
            "passengers": 2,
            "cabin": "Business",
            "type": "round",
            "returnDate": self.back.departure_datetime.date().isoformat(),
        }
        self.assertEqual(
            self.client.get("/api/flights/search/", query).status_code, 401
        )
        self.assertEqual(
            self.client.get(f"/api/flights/{self.flight.pk}/").status_code, 401
        )
        self.client.force_authenticate(self.user)
        response = self.client.get("/api/flights/search/", query)
        self.assertEqual(response.status_code, 200, response.data)
        result = response.data["results"][0]
        self.assertEqual(result["price"], 280)
        self.assertEqual(result["seats"], 3)
        self.assertEqual(result["duration"], 480)
        detail = self.client.get(f"/api/flights/{self.flight.pk}/?cabin=Business")
        self.assertEqual(detail.data["price"], result["price"])
        self.assertEqual(
            self.client.get("/api/flights/search/", {**query, "passengers": 4}).data[
                "count"
            ],
            0,
        )
        self.assertEqual(
            self.client.get(
                "/api/flights/search/", {**query, "returnDate": "bad"}
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.get(
                "/api/flights/search/", {**query, "origin": "D"}
            ).status_code,
            400,
        )

    def test_oneway_booking_payment_and_ownership(self):
        response = self.reserve(total=1, status="Confirmed")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], "Pending")
        self.assertEqual(response.data["total"], Decimal("100"))
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 2)
        pk = response.data["id"]
        paid = self.pay(pk)
        self.assertEqual(paid.status_code, 200, paid.data)
        self.assertEqual(paid.data["status"], "Confirmed")
        self.assertEqual(paid.data["paymentStatus"], "Simulated")
        self.assertTrue(paid.data["demo"])
        self.assertEqual(self.pay(pk).status_code, 200)
        self.assertEqual(Payment.objects.count(), 1)
        self.assertEqual(self.client.get("/api/bookings/").data["count"], 1)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get("/api/bookings/").data["count"], 0)
        for suffix in ["", "status/"]:
            self.assertEqual(
                self.client.get(f"/api/bookings/{pk}/{suffix}").status_code, 404
            )
        self.assertEqual(self.pay(pk).status_code, 404)
        self.assertEqual(
            self.client.post(f"/api/bookings/{pk}/cancel/").status_code, 404
        )
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get("/api/bookings/").data["count"], 0)
        self.assertEqual(self.client.get("/api/admin/bookings/").data["count"], 1)

    def test_round_trip_multiple_passengers_and_snapshot(self):
        self.passengers *= 2
        response = self.reserve(
            [str(self.flight.pk), str(self.back.pk)], cabin="Business"
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["total"], Decimal("1120.00"))
        self.assertEqual(len(response.data["segments"]), 2)
        for flight in [self.flight, self.back]:
            flight.refresh_from_db()
            self.assertEqual(flight.available_seats, 1)
        Flight.objects.filter(pk=self.flight.pk).update(price=999, status="Delayed")
        detail = self.client.get(f"/api/bookings/{response.data['id']}/").data
        self.assertEqual(detail["flights"][0]["price"], 280)
        self.assertEqual(detail["flights"][0]["status"], "Delayed")
        self.assertEqual(detail["total"], Decimal("1120"))

    def test_idempotent_booking_and_payload_conflict(self):
        key = str(uuid.uuid4())
        first = self.reserve(key=key)
        second = self.reserve(key=key)
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(second.status_code, 200)
        self.assertEqual(Booking.objects.count(), 1)
        self.assertEqual(self.reserve(key=key, cabin="Business").status_code, 409)
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 2)

    def test_booking_validation_atomicity(self):
        self.assertEqual(
            self.reserve([str(self.flight.pk), str(self.flight.pk)]).status_code, 400
        )
        self.assertEqual(self.reserve([str(uuid.uuid4())]).status_code, 400)
        invalid_return = self.make_flight(
            "AB103", "DEL", "DXB", self.departure + timedelta(days=2)
        )
        self.assertEqual(
            self.reserve([str(self.flight.pk), str(invalid_return.pk)]).status_code, 400
        )
        self.passengers *= 4
        self.assertEqual(self.reserve().status_code, 409)
        self.assertEqual(Booking.objects.count(), 0)
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 3)

    def test_failed_payment_and_expiry_release_once(self):
        pk = self.reserve().data["id"]
        response = self.pay(pk, "failure")
        self.assertEqual(response.data["status"], "Cancelled")
        self.assertEqual(self.pay(pk, "failure").status_code, 200)
        self.assertEqual(self.pay(pk, "success").status_code, 409)
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 3)
        other = self.reserve().data["id"]
        Booking.objects.filter(pk=other).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )
        self.assertEqual(self.pay(other).status_code, 409)
        expire(other)
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 3)

    def test_background_expiry_and_cancellation(self):
        pk = self.reserve().data["id"]
        Booking.objects.filter(pk=pk).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )
        expire(pk)
        expire(pk)
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 3)
        pk = self.reserve().data["id"]
        self.pay(pk)
        cancelled = self.client.post(f"/api/bookings/{pk}/cancel/")
        self.assertEqual(cancelled.data["paymentStatus"], "Refunded")
        self.client.post(f"/api/bookings/{pk}/cancel/")
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 3)

    @override_settings(
        AIRLABS_API_KEY="snapshot-test-key",
        FLIGHT_STATUS_PROVIDER="airlabs",
        EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
        EMAIL_HOST_PASSWORD="snapshot-test-password",
        CELERY_TASK_ALWAYS_EAGER=False,
    )
    def test_operations_snapshot_shows_queues_and_source_without_credentials(self):
        path = "/api/admin/operations/"
        self.assertEqual(self.client.get(path).status_code, 403)
        reservation = self.reserve()
        self.assertEqual(reservation.status_code, 201)
        self.back.schedule_source = "airlabs_routes"
        self.back.save(update_fields=["schedule_source"])
        pending = User.objects.create_user("pending@example.com", name="Pending User")
        Notification.objects.create(user=self.user, status="approved")
        Notification.objects.create(user=self.user, status="rejected")

        self.client.force_authenticate(self.admin)
        response = self.client.get(path)
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        self.assertEqual(data["pending_approvals"], 1)
        self.assertEqual(data["approval_queue"][0]["id"], str(pending.pk))
        self.assertEqual(data["active_reservations"], 1)
        self.assertEqual(
            data["recent_bookings"][0]["reference"], reservation.data["reference"]
        )
        self.assertEqual((data["airlabs_departures"], data["saved_departures"]), (1, 1))
        self.assertTrue(data["airlabs_configured"])
        self.assertTrue(data["airlabs_status_enabled"])
        self.assertEqual(data["email_mode"], "smtp")
        self.assertFalse(data["email_inline"])
        self.assertEqual(data["queued_emails"], 1)
        self.assertNotIn(b"snapshot-test", response.content)

        Booking.objects.filter(pk=reservation.data["id"]).update(
            expires_at=timezone.now()
        )
        self.assertEqual(self.client.get(path).data["active_reservations"], 0)

    def test_admin_flights_capacity_status_and_history(self):
        origin, _ = Airport.objects.get_or_create(
            code="DEL", defaults={"name": "Delhi Airport", "city": "Delhi"}
        )
        destination, _ = Airport.objects.get_or_create(
            code="DXB", defaults={"name": "Dubai Airport", "city": "Dubai"}
        )
        Route.objects.get_or_create(origin=origin, destination=destination)
        reservation = self.reserve()
        self.client.force_authenticate(self.admin)
        path = f"/api/admin/flights/{self.flight.pk}/"
        self.assertEqual(self.client.patch(path, {"total_seats": 0}).status_code, 400)
        result = self.client.patch(path, {"total_seats": 5})
        self.assertEqual(result.data["seats"], 4)
        self.assertEqual(self.client.delete(path).status_code, 409)
        self.assertEqual(self.client.patch(path, {"origin": "BOM"}).status_code, 409)
        status = self.client.put(path + "status/", {"status": "Delayed"})
        self.assertEqual(status.data["status"], "Delayed")
        self.assertEqual(
            self.client.get(f"/api/flights/{self.flight.pk}/status/").data["source"],
            "manual",
        )
        stats = self.client.get("/api/admin/dashboard/").data
        self.assertEqual(stats["total_bookings"], 1)
        self.assertEqual(stats["pending_bookings"], 1)
        self.assertEqual(
            self.client.get(
                f"/api/admin/bookings/{reservation.data['id']}/"
            ).status_code,
            200,
        )
        payload = {
            "number": "AB999",
            "airline": "Test Airline",
            "origin": "DEL",
            "destination": "DXB",
            "departure_datetime": (self.departure + timedelta(days=2)).isoformat(),
            "arrival_datetime": (
                self.departure + timedelta(days=2, hours=3)
            ).isoformat(),
            "price": "150.00",
            "total_seats": 10,
        }
        created = self.client.post("/api/admin/flights/", payload)
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["seats"], 10)
        self.assertEqual(
            self.client.delete(f"/api/admin/flights/{created.data['id']}/").status_code,
            204,
        )

    def test_pending_users_and_profile_privileges(self):
        self.user.approval_status = "pending"
        self.user.save()
        self.assertEqual(self.reserve().status_code, 403)
        self.user.approval_status = "approved"
        self.user.save()
        result = self.client.patch(
            "/api/auth/me/",
            {"name": "Changed Name", "is_staff": True, "status": "rejected"},
        )
        self.assertEqual(result.data["name"], "Changed Name")
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_staff)
        self.assertEqual(self.user.approval_status, "approved")

    @override_settings(AIRLABS_API_KEY="test-key")
    @patch("apps.flight_tracking.providers.requests.get")
    def test_provider_matches_occurrence_and_supported_status(self, get):
        payload = {
            "response": {
                "dep_iata": "DEL",
                "arr_iata": "LHR",
                "dep_time_ts": self.departure.timestamp(),
                "status": "en-route",
            }
        }
        get.return_value.json.return_value = payload
        provider = AirLabsProvider()
        self.assertEqual(provider.fetch(self.flight).status, "Departed")
        payload["response"]["dep_time_ts"] += 86400
        self.assertIsNone(provider.fetch(self.flight))
        payload["response"]["dep_time_ts"] -= 86400
        payload["response"]["status"] = "unknown"
        self.assertIsNone(provider.fetch(self.flight))
        self.assertEqual(get.call_args.kwargs["timeout"], (3, 8))

    @override_settings(FLIGHT_STATUS_PROVIDER="airlabs")
    @patch("apps.flight_tracking.services.provider")
    def test_provider_failure_preserves_manual_status(self, provider):
        from apps.flight_tracking.services import synchronize

        provider.return_value.fetch.side_effect = TimeoutError()
        synchronize(self.flight.pk)
        synchronize(self.flight.pk)
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.status, "On time")
        self.assertEqual(provider.return_value.fetch.call_count, 1)
