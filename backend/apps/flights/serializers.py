from datetime import datetime, timedelta
from django.utils import timezone
from rest_framework import serializers
from common.validators import iata
from .models import Flight, CABINS, STATUSES


class FlightSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)
    date = serializers.SerializerMethodField()
    departure = serializers.SerializerMethodField()
    arrival = serializers.SerializerMethodField()
    arrivalDay = serializers.SerializerMethodField()
    duration = serializers.SerializerMethodField()
    seats = serializers.IntegerField(source="available_seats", read_only=True)
    updatedAt = serializers.DateTimeField(source="status_updated_at", read_only=True)
    price = serializers.SerializerMethodField()

    class Meta:
        model = Flight
        fields = [
            "id",
            "route",
            "demonstration",
            "schedule_source",
            "aircraft",
            "number",
            "airline",
            "airline_code",
            "origin",
            "origin_airport",
            "origin_city",
            "destination",
            "destination_airport",
            "destination_city",
            "date",
            "departure",
            "arrival",
            "arrivalDay",
            "duration",
            "stops",
            "price",
            "currency",
            "seats",
            "total_seats",
            "status",
            "updatedAt",
            "status_source",
            "departure_datetime",
            "arrival_datetime",
        ]

    def get_date(self, obj) -> str:
        return obj.departure_datetime.date().isoformat()

    def get_departure(self, obj) -> str:
        return obj.departure_datetime.strftime("%H:%M")

    def get_arrival(self, obj) -> str:
        return obj.arrival_datetime.strftime("%H:%M")

    def get_arrivalDay(self, obj) -> int:
        return (obj.arrival_datetime.date() - obj.departure_datetime.date()).days

    def get_duration(self, obj) -> int:
        return int((obj.arrival_datetime - obj.departure_datetime).total_seconds() / 60)

    def get_price(self, obj) -> float:
        return float(obj.fare(self.context.get("cabin", "Economy")))


class FlightWriteSerializer(serializers.ModelSerializer):
    origin = serializers.CharField(required=False, validators=[iata])
    destination = serializers.CharField(required=False, validators=[iata])

    class Meta:
        model = Flight
        fields = [
            "route",
            "number",
            "airline",
            "airline_code",
            "origin",
            "origin_airport",
            "origin_city",
            "destination",
            "destination_airport",
            "destination_city",
            "departure_datetime",
            "arrival_datetime",
            "price",
            "currency",
            "total_seats",
            "stops",
            "status",
        ]

    def validate(self, attrs):
        def get(key):
            return attrs.get(key, getattr(self.instance, key, None))

        route = attrs.get("route")
        if route:
            for field in ("origin", "destination"):
                airport = getattr(route, field)
                attrs[field] = airport.code
                attrs[f"{field}_airport"] = airport.name
                attrs[f"{field}_city"] = airport.city
        if not get("origin") or not get("destination"):
            raise serializers.ValidationError({"route": "Select a route."})
        if get("origin") == get("destination"):
            raise serializers.ValidationError(
                {"destination": "Choose different airports."}
            )
        if (
            get("arrival_datetime")
            and get("departure_datetime")
            and get("arrival_datetime") <= get("departure_datetime")
        ):
            raise serializers.ValidationError(
                {"arrival_datetime": "Arrival must be after departure."}
            )
        if get("total_seats") is not None and get("total_seats") < 1:
            raise serializers.ValidationError(
                {"total_seats": "Capacity must be at least one."}
            )
        if (
            not self.instance
            and get("departure_datetime")
            and get("departure_datetime") <= timezone.now()
        ):
            raise serializers.ValidationError(
                {"departure_datetime": "New flights must depart in the future."}
            )
        return attrs


class StatusWriteSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=STATUSES)


class CabinQuerySerializer(serializers.Serializer):
    cabin = serializers.ChoiceField(choices=list(CABINS), default="Economy")


class SearchSerializer(CabinQuerySerializer):
    origin = serializers.CharField(validators=[iata])
    destination = serializers.CharField(validators=[iata])
    departure = serializers.DateField()
    returnDate = serializers.CharField(required=False, allow_blank=True)
    passengers = serializers.IntegerField(min_value=1, max_value=9, default=1)
    type = serializers.ChoiceField(choices=["one", "round"], default="one")
    ordering = serializers.ChoiceField(
        choices=[
            "price",
            "-price",
            "departure_datetime",
            "-departure_datetime",
            "arrival_datetime",
        ],
        default="departure_datetime",
    )

    def validate(self, attrs):
        if attrs["origin"] == attrs["destination"]:
            raise serializers.ValidationError(
                {"destination": "Choose different airports."}
            )
        if attrs["departure"] < timezone.localdate():
            raise serializers.ValidationError(
                {"departure": "Use today or a future departure date."}
            )
        if attrs["departure"] > timezone.localdate() + timedelta(days=365):
            raise serializers.ValidationError(
                {"departure": "Search up to 365 days ahead."}
            )
        if attrs["type"] == "round":
            try:
                returned = datetime.strptime(
                    attrs.get("returnDate", ""), "%Y-%m-%d"
                ).date()
            except ValueError:
                raise serializers.ValidationError(
                    {"returnDate": "A valid return date is required."}
                )
            if returned < attrs["departure"]:
                raise serializers.ValidationError(
                    {"returnDate": "Return must be on or after departure."}
                )
        return attrs
