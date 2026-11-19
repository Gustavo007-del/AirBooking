from datetime import timedelta
from celery import shared_task
from django.conf import settings
from django.utils import timezone
from apps.flights.models import Flight
from .services import synchronize


@shared_task
def sync_flight(pk):
    synchronize(pk)


@shared_task
def sync_statuses():
    if settings.FLIGHT_STATUS_PROVIDER == "manual":
        return
    now = timezone.now()
    for pk in (
        Flight.objects.filter(
            demonstration=False,
            departure_datetime__gte=now - timedelta(hours=24),
            departure_datetime__lte=now + timedelta(hours=24),
        )
        .exclude(status__in=["Cancelled", "Arrived"])
        .values_list("pk", flat=True)
        .iterator()
    ):
        sync_flight.delay(str(pk))
