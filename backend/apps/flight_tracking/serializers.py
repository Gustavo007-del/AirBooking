from rest_framework import serializers
from apps.flights.models import Flight


class FlightStatusSerializer(serializers.ModelSerializer):
    updatedAt = serializers.DateTimeField(source="status_updated_at", read_only=True)
    source = serializers.CharField(source="status_source", read_only=True)

    class Meta:
        model = Flight
        fields = [
            "id",
            "number",
            "status",
            "updatedAt",
            "source",
            "aircraft",
            "departure_datetime",
            "arrival_datetime",
        ]


class BookingStatusSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    reference = serializers.CharField()
    status = serializers.CharField()
    paymentStatus = serializers.CharField()
    flights = FlightStatusSerializer(many=True)
