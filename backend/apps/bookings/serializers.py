from django.utils import timezone
from rest_framework import serializers
from apps.flights.models import CABINS
from .models import Booking, BookingSegment, Passenger


class PassengerSerializer(serializers.ModelSerializer):
    firstName = serializers.CharField(source="first_name", min_length=2, max_length=80)
    lastName = serializers.CharField(source="last_name", min_length=2, max_length=80)
    birthDate = serializers.DateField(source="birth_date")

    class Meta:
        model = Passenger
        fields = ["firstName", "lastName", "email", "birthDate"]

    def validate_birthDate(self, value):
        if (
            value >= timezone.localdate()
            or value.year < timezone.localdate().year - 120
        ):
            raise serializers.ValidationError("Enter a valid past date of birth.")
        return value


class CreateBookingSerializer(serializers.Serializer):
    flight_ids = serializers.ListField(
        child=serializers.UUIDField(), min_length=1, max_length=2
    )
    passengers = PassengerSerializer(many=True, min_length=1, max_length=9)
    cabin = serializers.ChoiceField(choices=list(CABINS), default="Economy")

    def validate_flight_ids(self, value):
        if len(set(value)) != len(value):
            raise serializers.ValidationError("Select distinct flight legs.")
        return value


class SegmentSerializer(serializers.ModelSerializer):
    flight_id = serializers.UUIDField(read_only=True)
    live_status = serializers.CharField(source="flight.status", read_only=True)

    class Meta:
        model = BookingSegment
        fields = ["order", "flight_id", "unit_price", "snapshot", "live_status"]


class UpdateBookingSerializer(serializers.Serializer):
    passengers = PassengerSerializer(many=True, min_length=1, max_length=9)


class BookingSerializer(serializers.ModelSerializer):
    userId = serializers.UUIDField(source="user_id", read_only=True)
    flights = serializers.SerializerMethodField()
    passengers = PassengerSerializer(many=True, read_only=True)
    segments = SegmentSerializer(many=True, read_only=True)
    total = serializers.DecimalField(
        source="total_price",
        max_digits=14,
        decimal_places=2,
        coerce_to_string=False,
        read_only=True,
    )
    paymentStatus = serializers.CharField(source="payment_status", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    demo = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id",
            "reference",
            "userId",
            "flights",
            "passengers",
            "segments",
            "total",
            "total_price",
            "currency",
            "cabin",
            "passenger_count",
            "status",
            "paymentStatus",
            "createdAt",
            "expires_at",
            "demo",
        ]

    def get_demo(self, obj) -> bool:
        return True

    def get_flights(self, obj) -> list[dict]:
        # Historical schedule/fare remains fixed; live operational status remains current.
        return [
            {
                **s.snapshot,
                "status": s.flight.status,
                "status_source": s.flight.status_source,
                "aircraft": s.flight.aircraft,
                "updatedAt": s.flight.status_updated_at.isoformat()
                if s.flight.status_updated_at
                else None,
            }
            for s in obj.segments.all()
        ]
