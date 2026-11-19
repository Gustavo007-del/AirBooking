from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from common.exceptions import Conflict
from .models import Flight, Route
from apps.flight_tracking.models import StatusEvent


def record_status(flight, status, source="manual", observed_at=None):
    flight.status = status
    flight.status_source = source
    flight.status_updated_at = observed_at or timezone.now()
    flight.save(
        update_fields=["status", "status_source", "status_updated_at", "updated_at"]
    )
    StatusEvent.objects.create(
        flight=flight,
        status=status,
        source=source,
        observed_at=flight.status_updated_at,
    )


def resolve_route(data, current=None):
    route = data.get("route")
    if route is None:
        origin = data.get("origin", getattr(current, "origin", None))
        destination = data.get("destination", getattr(current, "destination", None))
        route = Route.objects.filter(
            origin__code=origin, destination__code=destination
        ).first()
    if route is None:
        if current and not {"origin", "destination", "route"}.intersection(data):
            return
        raise ValidationError({"route": "Select an existing route."})
    route = Route.objects.select_for_update().get(pk=route.pk)
    if (
        not route.active or not route.origin.active or not route.destination.active
    ) and (current is None or current.route_id != route.pk):
        raise ValidationError({"route": "Select an active route with active airports."})
    data["route"] = route
    for field in ("origin", "destination"):
        airport = getattr(route, field)
        data.update(
            {
                field: airport.code,
                f"{field}_airport": airport.name,
                f"{field}_city": airport.city,
            }
        )


@transaction.atomic
def create_flight(data):
    data = dict(data)
    resolve_route(data)
    flight = Flight(**data, available_seats=data["total_seats"])
    flight.full_clean()
    flight.save()
    record_status(flight, flight.status)
    return flight


@transaction.atomic
def update_flight(pk, data):
    flight = Flight.objects.select_for_update().get(pk=pk)
    data = dict(data)
    reserved = flight.total_seats - flight.available_seats
    capacity = data.get("total_seats", flight.total_seats)
    if capacity < reserved:
        raise ValidationError(
            {"total_seats": "Capacity cannot be lower than seats already reserved."}
        )
    # Existing reservations retain snapshots; prevent silently rerouting their live flight.
    route_fields = [
        "origin",
        "destination",
        "departure_datetime",
        "arrival_datetime",
        "number",
        "currency",
    ]
    if flight.booking_segments.exists() and any(
        k in data and data[k] != getattr(flight, k) for k in route_fields
    ):
        raise Conflict(
            "Booked flight identity, schedule and currency cannot be rewritten. Update its status instead."
        )
    if {"origin", "destination", "route"}.intersection(data):
        resolve_route(data, flight)
    changed_status = data.get("status", flight.status) != flight.status
    for key, value in data.items():
        setattr(flight, key, value)
    flight.available_seats = capacity - reserved
    flight.full_clean()
    flight.save()
    if changed_status:
        record_status(flight, flight.status)
    return flight


@transaction.atomic
def delete_flight(pk):
    flight = Flight.objects.select_for_update().get(pk=pk)
    if flight.booking_segments.exists():
        raise Conflict("Flights with booking history cannot be deleted.")
    flight.delete()
