from django.db import transaction
from django.utils import timezone
from common.exceptions import Conflict
from apps.bookings.models import Booking
from apps.bookings.services import release_locked
from apps.flights.models import Flight
from .models import Payment


@transaction.atomic
def simulate(booking_id, outcome):
    booking = Booking.objects.select_for_update().get(pk=booking_id)
    prior = Payment.objects.filter(booking=booking).first()
    if prior:
        if prior.outcome != outcome:
            raise Conflict(
                "A different payment outcome has already been recorded for this booking."
            )
        return booking, None
    if booking.status != "Pending":
        raise Conflict("This booking is not eligible for payment.")
    # Serialize against flight cancellation and inventory edits as well as other payments.
    ids = list(booking.segments.values_list("flight_id", flat=True))
    flights = list(Flight.objects.select_for_update().filter(pk__in=ids).order_by("pk"))
    if booking.expires_at <= timezone.now() or any(
        f.status in ["Cancelled", "Departed", "Arrived"] for f in flights
    ):
        release_locked(booking, "Failed")
        return (
            booking,
            "Reservation expired or a flight became unavailable. Seats have been released.",
        )
    Payment.objects.create(
        booking=booking,
        amount=booking.total_price,
        currency=booking.currency,
        outcome=outcome,
    )
    if outcome == "failure":
        release_locked(booking, "Failed")
    else:
        booking.status = "Confirmed"
        booking.payment_status = "Simulated"
        booking.save(update_fields=["status", "payment_status", "updated_at"])
    return booking, None
