from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Protocol
import requests
from django.conf import settings


@dataclass(frozen=True)
class Observation:
    status: str
    observed_at: datetime
    aircraft: dict = field(default_factory=dict)


def airlabs_request(resource, **params):
    response = requests.get(
        f"https://airlabs.co/api/v9/{resource}",
        params={**params, "api_key": settings.AIRLABS_API_KEY},
        timeout=(3, 8),
    )
    response.raise_for_status()
    payload = response.json()
    if (
        not isinstance(payload, dict)
        or payload.get("error")
        or "response" not in payload
    ):
        raise ValueError("AirLabs did not return a valid response.")
    return payload["response"]


def aircraft_details(data):
    return {
        key: value.strip()[:120]
        for key in ("aircraft_icao", "model", "manufacturer", "reg_number")
        if isinstance(value := data.get(key), str) and value.strip()
    }


def provider_status(data):
    status = {
        "scheduled": "Scheduled",
        "en-route": "Departed",
        "active": "Departed",
        "landed": "Arrived",
        "cancelled": "Cancelled",
    }.get(data.get("status"))
    delay = data.get("dep_delayed")
    if status == "Scheduled" and isinstance(delay, (int, float)) and delay > 0:
        return "Delayed"
    return status


class Provider(Protocol):
    def fetch(self, flight) -> Observation | None: ...


class ManualProvider:
    def fetch(self, flight):
        return None


class AirLabsProvider:
    """The flight endpoint returns the nearest occurrence; match route AND date."""

    def fetch(self, flight):
        if not settings.AIRLABS_API_KEY:
            return None
        data = airlabs_request(
            "flight", flight_iata=flight.number.replace(" ", "").upper()
        )
        if not isinstance(data, dict):
            return None
        if (
            data.get("dep_iata") != flight.origin
            or data.get("arr_iata") != flight.destination
        ):
            return None
        departure = datetime.fromtimestamp(float(data["dep_time_ts"]), tz=timezone.utc)
        if abs((departure - flight.departure_datetime).total_seconds()) > 3600:
            return None
        mapped = provider_status(data)
        if mapped is None:
            return None
        # "updated" is last aircraft signal, not necessarily schedule status freshness.
        return Observation(mapped, datetime.now(timezone.utc), aircraft_details(data))


def provider() -> Provider:
    return (
        AirLabsProvider()
        if settings.FLIGHT_STATUS_PROVIDER == "airlabs"
        else ManualProvider()
    )
