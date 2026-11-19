import logging
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from apps.flights.models import Flight
from apps.flights.services import record_status
from .providers import provider

logger = logging.getLogger(__name__)


def synchronize(pk):
    if settings.FLIGHT_STATUS_PROVIDER == "manual":
        return
    try:
        if not cache.add(
            f"flight-status-poll:{pk}", True, settings.FLIGHT_STATUS_CACHE_SECONDS
        ):
            return
        flight = Flight.objects.get(pk=pk)
        if flight.demonstration:
            return
        version = flight.status_updated_at
        observation = provider().fetch(flight)
        if observation is None:
            return
        with transaction.atomic():
            flight = Flight.objects.select_for_update().get(pk=pk)
            # Never override a cancellation or a manual update made while fetching.
            if flight.status == "Cancelled" or flight.status_updated_at != version:
                return
            if observation.aircraft:
                flight.aircraft = {**flight.aircraft, **observation.aircraft}
                flight.save(update_fields=["aircraft"])
            record_status(
                flight, observation.status, "airlabs", observation.observed_at
            )
    except Flight.DoesNotExist:
        return
    except Exception as exc:
        # Do not log request URLs/exceptions containing API credentials.
        logger.warning(
            "Flight status sync failed for %s (%s); preserving stored status",
            pk,
            type(exc).__name__,
        )
