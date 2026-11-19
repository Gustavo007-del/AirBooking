import hashlib
import json
from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError, PermissionDenied
from common.exceptions import Conflict
from common.permissions import eligible
from apps.accounts.models import User
from apps.flights.models import Flight
from apps.flights.serializers import FlightSerializer
from .models import Booking, BookingSegment, Passenger


def booking_queryset():
    from django.db.models import Prefetch

    return Booking.objects.select_related("user").prefetch_related(
        "passengers",
        Prefetch(
            "segments",
            queryset=BookingSegment.objects.select_related("flight").order_by("order"),
        ),
    )


@transaction.atomic
def reserve(user, data, key):
    if not key or len(key) > 128:
        raise ValidationError(
            {"Idempotency-Key": "Send a non-empty key of at most 128 characters."}
        )
    user = User.objects.select_for_update().get(pk=user.pk)
    if not eligible(user):
        raise PermissionDenied("An approved account is required.")
    fingerprint = hashlib.sha256(
        json.dumps(data, sort_keys=True, default=str, separators=(",", ":")).encode()
    ).hexdigest()
    prior = Booking.objects.filter(user=user, idempotency_key=key).first()
    if prior:
        if prior.request_hash != fingerprint:
            raise Conflict(
                "This idempotency key was used for a different booking request."
            )
        return prior, False
    ids = data["flight_ids"]
    # Stable UUID ordering prevents deadlocks on opposite-direction round trips.
    locked = list(Flight.objects.select_for_update().filter(pk__in=ids).order_by("pk"))
    if len(locked) != len(ids):
        raise ValidationError({"flight_ids": "One or more flights do not exist."})
    by_id = {flight.pk: flight for flight in locked}
    flights = [by_id[pk] for pk in ids]
    count = len(data["passengers"])
    now = timezone.now()
    for flight in flights:
        if flight.route_id and not (
            flight.route.active
            and flight.route.origin.active
            and flight.route.destination.active
        ):
            raise Conflict("A selected route is no longer available.")
        if flight.departure_datetime <= now or flight.status not in [
            "Scheduled",
            "On time",
            "Delayed",
        ]:
            raise Conflict("A selected flight is no longer bookable.")
        if flight.available_seats < count:
            raise Conflict("There are not enough seats on a selected flight.")
    if len(flights) == 2:
        outbound, inbound = flights
        if (
            outbound.origin != inbound.destination
            or outbound.destination != inbound.origin
            or inbound.departure_datetime <= outbound.arrival_datetime
        ):
            raise ValidationError(
                {
                    "flight_ids": "Return flight must reverse the route and depart after outbound arrival."
                }
            )
    if len({flight.currency for flight in flights}) != 1:
        raise ValidationError("All segments must use the same currency.")
    cabin = data["cabin"]
    total = sum(f.fare(cabin) for f in flights) * count
    booking = Booking.objects.create(
        user=user,
        passenger_count=count,
        total_price=total,
        currency=flights[0].currency,
        cabin=cabin,
        idempotency_key=key,
        request_hash=fingerprint,
        expires_at=min(
            now + timedelta(minutes=settings.RESERVATION_MINUTES),
            flights[0].departure_datetime,
        ),
    )
    for order, flight in enumerate(flights):
        snapshot = dict(FlightSerializer(flight, context={"cabin": cabin}).data)
        BookingSegment.objects.create(
            booking=booking,
            flight=flight,
            order=order,
            unit_price=flight.fare(cabin),
            snapshot=snapshot,
        )
        flight.available_seats -= count
        flight.save(update_fields=["available_seats", "updated_at"])
    Passenger.objects.bulk_create(
        [Passenger(booking=booking, **p) for p in data["passengers"]]
    )
    return booking, True


def release_locked(booking, payment_status=None):
    """Caller must hold a booking row lock inside an atomic transaction."""
    if booking.status == "Cancelled":
        return
    ids = list(booking.segments.values_list("flight_id", flat=True))
    flights = Flight.objects.select_for_update().filter(pk__in=ids).order_by("pk")
    for flight in flights:
        flight.available_seats += booking.passenger_count
        if flight.available_seats > flight.total_seats:
            raise Conflict("Inventory inconsistency; contact the administrator.")
        flight.save(update_fields=["available_seats", "updated_at"])
    booking.status = "Cancelled"
    if payment_status:
        booking.payment_status = payment_status
    booking.save(update_fields=["status", "payment_status", "updated_at"])


@transaction.atomic
def cancel(booking_id):
    booking = Booking.objects.select_for_update().get(pk=booking_id)
    if booking.status == "Cancelled":
        return booking
    if (
        booking.status == "Confirmed"
        and booking.segments.filter(
            flight__departure_datetime__lte=timezone.now()
        ).exists()
    ):
        raise Conflict("A departed reservation cannot be cancelled.")
    release_locked(
        booking, "Refunded" if booking.payment_status == "Simulated" else "Failed"
    )
    return booking


@transaction.atomic
def update_passengers(booking_id, passengers):
    booking = Booking.objects.select_for_update().get(pk=booking_id)
    if booking.status != "Pending" or booking.expires_at <= timezone.now():
        raise Conflict(
            "Passenger details can only change while the reservation hold is active."
        )
    if len(passengers) != booking.passenger_count:
        raise ValidationError(
            {
                "passengers": "Keep the original passenger count. Cancel and rebook to change it."
            }
        )
    booking.passengers.all().delete()
    Passenger.objects.bulk_create(
        [Passenger(booking=booking, **item) for item in passengers]
    )
    booking.save(update_fields=["updated_at"])
    return booking


@transaction.atomic
def expire(booking_id):
    booking = Booking.objects.select_for_update().get(pk=booking_id)
    if booking.status == "Pending" and booking.expires_at <= timezone.now():
        release_locked(booking, "Failed")
