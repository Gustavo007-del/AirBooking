from datetime import datetime, timedelta, timezone
import logging

import requests
from django.conf import settings
from django.core.cache import cache
from rest_framework import generics, serializers
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from common.validators import iata
from .providers import aircraft_details, airlabs_request, provider_status

logger = logging.getLogger(__name__)
SCHEDULE_WINDOW = timedelta(hours=10)


class FeedUnavailable(APIException):
    status_code = 503
    default_code = "airlabs_unavailable"
    default_detail = "AirLabs is temporarily unavailable. Try again shortly."


def cached_feed(resource, **params):
    query_key = ":".join(f"{field}={value}" for field, value in sorted(params.items()))
    key = f"airlabs:v2:{resource}:{query_key}"
    response = cache.get(key)
    if response is not None:
        return response
    if not cache.add(f"{key}:fetching", True, 15):
        raise FeedUnavailable()
    try:
        response = airlabs_request(resource, **params)
        ttl = (
            settings.AIRLABS_TIMETABLE_CACHE_SECONDS
            if resource == "routes"
            else settings.AIRLABS_LOOKUP_CACHE_SECONDS
        )
        cache.set(key, response, ttl)
        return response
    except (requests.RequestException, ValueError) as exc:
        # The provider URL contains a key. Log only the exception type.
        logger.warning("AirLabs %s lookup failed (%s)", resource, type(exc).__name__)
        raise FeedUnavailable() from None
    finally:
        cache.delete(f"{key}:fetching")


def timestamp(row, field):
    try:
        return datetime.fromtimestamp(float(row[field]), tz=timezone.utc)
    except (KeyError, OverflowError, OSError, TypeError, ValueError):
        return None


def live_record(row):
    number = row.get("flight_iata")
    origin, destination = row.get("dep_iata"), row.get("arr_iata")
    departure, arrival = timestamp(row, "dep_time_ts"), timestamp(row, "arr_time_ts")
    if (
        not all(
            isinstance(value, str) and value for value in (number, origin, destination)
        )
        or not departure
        or not arrival
    ):
        return None
    return {
        "number": number,
        "origin": origin,
        "destination": destination,
        "departure": departure,
        "arrival": arrival,
        "status": provider_status(row) or "Unknown",
        "aircraft": aircraft_details(row),
        "signal_at": timestamp(row, "updated"),
    }


class LiveFlightSerializer(serializers.Serializer):
    number = serializers.CharField()
    origin = serializers.CharField()
    destination = serializers.CharField()
    departure = serializers.DateTimeField()
    arrival = serializers.DateTimeField()
    status = serializers.CharField()
    aircraft = serializers.DictField(child=serializers.CharField())
    signal_at = serializers.DateTimeField(allow_null=True)


class LiveLookupQuery(serializers.Serializer):
    number = serializers.RegexField(r"^[A-Z0-9]{2}[0-9]{1,5}[A-Z]?$", max_length=8)


class ScheduleQuery(serializers.Serializer):
    origin = serializers.CharField(validators=[iata])
    destination = serializers.CharField(validators=[iata])
    departure = serializers.DateField()
    upcoming = serializers.BooleanField(default=False)


class LiveFlightLookup(generics.GenericAPIView):
    serializer_class = LiveFlightSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "airlabs"

    def get(self, request):
        query = LiveLookupQuery(data=request.query_params)
        query.is_valid(raise_exception=True)
        if not settings.AIRLABS_API_KEY:
            raise FeedUnavailable(
                "Flight-number tracking is unavailable until AirLabs is configured."
            )
        number = query.validated_data["number"]
        row = cached_feed("flight", flight_iata=number)
        record = (
            live_record(row)
            if isinstance(row, dict) and row.get("flight_iata") == number
            else None
        )
        if not record:
            from rest_framework.exceptions import NotFound

            raise NotFound("AirLabs found no matching flight occurrence.")
        return Response(self.get_serializer(record).data)


class ScheduleResponseSerializer(serializers.Serializer):
    configured = serializers.BooleanField()
    outside_window = serializers.BooleanField()
    results = LiveFlightSerializer(many=True)


class LiveScheduleView(generics.GenericAPIView):
    serializer_class = ScheduleResponseSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "airlabs"

    def get(self, request):
        query = ScheduleQuery(data=request.query_params)
        query.is_valid(raise_exception=True)
        if not settings.AIRLABS_API_KEY:
            return Response(
                {"configured": False, "outside_window": False, "results": []}
            )
        filters = query.validated_data
        now = datetime.now(timezone.utc)
        end = now + SCHEDULE_WINDOW
        upcoming = filters["upcoming"]
        if not upcoming and not now.date() <= filters["departure"] <= end.date():
            return Response({"configured": True, "outside_window": True, "results": []})
        payload = cached_feed(
            "schedules",
            dep_iata=filters["origin"],
            arr_iata=filters["destination"],
            limit=50,
        )
        if not isinstance(payload, list):
            raise FeedUnavailable()
        records = []
        seen = set()
        for row in payload:
            record = live_record(row) if isinstance(row, dict) else None
            if (
                not record
                or record["origin"] != filters["origin"]
                or record["destination"] != filters["destination"]
                or not now <= record["departure"] <= end
                or (not upcoming and record["departure"].date() != filters["departure"])
            ):
                continue
            key = (record["number"], record["departure"])
            if key not in seen:
                seen.add(key)
                records.append(record)
        return Response(
            self.get_serializer(
                {
                    "configured": True,
                    "outside_window": False,
                    "results": sorted(records, key=lambda item: item["departure"]),
                }
            ).data
        )
