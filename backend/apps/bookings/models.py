import uuid
from django.conf import settings
from django.db import models
from django.db.models import Q


def reference():
    return uuid.uuid4().hex[:12].upper()


class Booking(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(
        max_length=12, unique=True, default=reference, editable=False
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="bookings"
    )
    passenger_count = models.PositiveSmallIntegerField()
    total_price = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3)
    cabin = models.CharField(max_length=20, default="Economy")
    status = models.CharField(
        max_length=12,
        choices=[
            ("Pending", "Pending"),
            ("Confirmed", "Confirmed"),
            ("Cancelled", "Cancelled"),
        ],
        default="Pending",
        db_index=True,
    )
    payment_status = models.CharField(
        max_length=12,
        choices=[
            ("Pending", "Pending"),
            ("Simulated", "Simulated"),
            ("Failed", "Failed"),
            ("Refunded", "Refunded"),
        ],
        default="Pending",
    )
    idempotency_key = models.CharField(max_length=128)
    request_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "idempotency_key"], name="booking_user_idempotency"
            ),
            models.CheckConstraint(
                condition=Q(passenger_count__gte=1, passenger_count__lte=9),
                name="booking_passenger_range",
            ),
            models.CheckConstraint(
                condition=Q(total_price__gt=0), name="booking_positive_total"
            ),
        ]


class BookingSegment(models.Model):
    booking = models.ForeignKey(
        Booking, related_name="segments", on_delete=models.CASCADE
    )
    flight = models.ForeignKey(
        "flights.Flight", on_delete=models.PROTECT, related_name="booking_segments"
    )
    order = models.PositiveSmallIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    snapshot = models.JSONField()

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["booking", "order"], name="booking_segment_order"
            ),
            models.UniqueConstraint(
                fields=["booking", "flight"], name="booking_segment_flight"
            ),
        ]


class Passenger(models.Model):
    booking = models.ForeignKey(
        Booking, related_name="passengers", on_delete=models.CASCADE
    )
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80)
    email = models.EmailField()
    birth_date = models.DateField()
