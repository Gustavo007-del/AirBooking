from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from decimal import Decimal
from django.db import transaction
from django.db.models import Case, When, Value, IntegerField
from rest_framework import serializers, viewsets
from rest_framework.permissions import AllowAny
from common.permissions import IsAdministrator
from .models import Airport, Route


class AirportSerializer(serializers.ModelSerializer):
    active = serializers.BooleanField(required=False, default=True)

    class Meta:
        model = Airport
        fields = "__all__"

    def validate_code(self, value):
        if self.instance and self.instance.code != value:
            raise serializers.ValidationError(
                "Airport codes cannot change. Create a new airport instead."
            )
        return value

    def validate_latitude(self, value):
        if value is not None and abs(value) > Decimal(90):
            raise serializers.ValidationError("Latitude must be between -90 and 90.")
        return value

    def validate_longitude(self, value):
        if value is not None and abs(value) > Decimal(180):
            raise serializers.ValidationError("Longitude must be between -180 and 180.")
        return value

    def validate_timezone(self, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise serializers.ValidationError(
                "Enter an IANA time zone such as Asia/Kolkata."
            )
        return value


class RouteSerializer(serializers.ModelSerializer):
    active = serializers.BooleanField(required=False, default=True)
    origin_detail = AirportSerializer(source="origin", read_only=True)
    destination_detail = AirportSerializer(source="destination", read_only=True)

    class Meta:
        model = Route
        fields = "__all__"

    def validate(self, attrs):
        origin = attrs.get("origin", getattr(self.instance, "origin", None))
        destination = attrs.get(
            "destination", getattr(self.instance, "destination", None)
        )
        if origin == destination:
            raise serializers.ValidationError("Choose different airports.")
        if (
            self.instance
            and self.instance.flights.exists()
            and (
                origin != self.instance.origin
                or destination != self.instance.destination
            )
        ):
            raise serializers.ValidationError(
                "Create a new route to change airports on a route with flights."
            )
        return attrs


class PublicAirports(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = AirportSerializer
    queryset = Airport.objects.filter(active=True)
    search_fields = ["code", "name", "city", "region", "country"]

    def get_queryset(self):
        queryset = super().get_queryset()
        query = self.request.query_params.get("search", "").strip()
        if not query:
            return queryset
        return queryset.annotate(
            relevance=Case(
                When(code__iexact=query, then=Value(0)),
                When(city__iexact=query, then=Value(1)),
                When(name__istartswith=query, then=Value(2)),
                When(city__istartswith=query, then=Value(3)),
                default=Value(4),
                output_field=IntegerField(),
            )
        ).order_by("relevance", "city", "code")


class PublicRoutes(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = RouteSerializer
    queryset = Route.objects.select_related("origin", "destination").filter(
        active=True, origin__active=True, destination__active=True
    )
    filterset_fields = ["origin", "destination"]
    search_fields = [
        "origin__city",
        "destination__city",
        "origin__code",
        "destination__code",
    ]


class PublicDestinations(PublicAirports):
    queryset = Airport.objects.filter(
        active=True, inbound_routes__active=True, inbound_routes__origin__active=True
    ).distinct()


class AdminAirports(PublicAirports, viewsets.ModelViewSet):
    permission_classes = [IsAdministrator]
    queryset = Airport.objects.all()
    filterset_fields = ["active", "country"]
    http_method_names = ["get", "post", "patch", "head", "options"]


class AdminRoutes(PublicRoutes, viewsets.ModelViewSet):
    permission_classes = [IsAdministrator]
    queryset = Route.objects.select_related("origin", "destination")
    filterset_fields = ["active", "origin", "destination"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        self.queryset = self.queryset.select_for_update(of=("self",))
        return super().update(request, *args, **kwargs)
