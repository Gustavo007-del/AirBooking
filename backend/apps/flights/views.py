from datetime import datetime, time, timedelta, timezone as dt_timezone
from django.utils import timezone
from django.db.models import Q
from rest_framework import generics
from rest_framework.response import Response
from common.permissions import IsAdministrator
from apps.flight_tracking.live import FeedUnavailable
from .models import Flight
from .serializers import (
    FlightSerializer,
    FlightWriteSerializer,
    SearchSerializer,
    StatusWriteSerializer,
    CabinQuerySerializer,
)
from . import services, timetable


class FlightContextMixin:
    def get_serializer_context(self):
        context = super().get_serializer_context()
        query = CabinQuerySerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        context["cabin"] = query.validated_data["cabin"]
        return context


class SearchView(FlightContextMixin, generics.ListAPIView):
    serializer_class = FlightSerializer
    filter_backends = []

    def get(self, request, *args, **kwargs):
        response = super().get(request, *args, **kwargs)
        response.data["source"] = self.search_source
        return response

    def get_queryset(self):
        query = SearchSerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        d = query.validated_data
        start = datetime.combine(d["departure"], time.min, tzinfo=dt_timezone.utc)
        end = start + timedelta(days=1)
        now = timezone.now()
        try:
            matches = timetable.flight_inclusions(d, start, end, now)
            self.search_source = "airlabs_routes"
        except FeedUnavailable:
            matches = Q()
            self.search_source = "database"
        return (
            Flight.objects.filter(
                origin=d["origin"],
                destination=d["destination"],
                departure_datetime__gte=max(start, now),
                departure_datetime__lt=end,
                available_seats__gte=d["passengers"],
                status__in=["Scheduled", "On time", "Delayed"],
            )
            .filter(
                Q(route__isnull=True)
                | Q(
                    route__active=True,
                    route__origin__active=True,
                    route__destination__active=True,
                )
            )
            .filter(matches)
            .order_by(d["ordering"], "id")
        )


class FlightDetailView(FlightContextMixin, generics.RetrieveAPIView):
    queryset = Flight.objects.all()
    serializer_class = FlightSerializer


class AdminFlightsView(generics.ListCreateAPIView):
    permission_classes = [IsAdministrator]
    queryset = Flight.objects.all()
    serializer_class = FlightSerializer
    filterset_fields = ["origin", "destination", "status", "route"]
    search_fields = ["number", "airline", "origin", "destination"]
    ordering_fields = ["departure_datetime", "price", "available_seats"]

    def post(self, request, *args, **kwargs):
        serializer = FlightWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            FlightSerializer(services.create_flight(serializer.validated_data)).data,
            status=201,
        )


class AdminFlightView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdministrator]
    queryset = Flight.objects.all()
    serializer_class = FlightSerializer

    def put(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def patch(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = FlightWriteSerializer(
            instance, data=request.data, partial=kwargs.get("partial", False)
        )
        serializer.is_valid(raise_exception=True)
        return Response(
            FlightSerializer(
                services.update_flight(instance.pk, serializer.validated_data)
            ).data
        )

    def perform_destroy(self, instance):
        services.delete_flight(instance.pk)


class AdminStatusView(generics.GenericAPIView):
    permission_classes = [IsAdministrator]
    queryset = Flight.objects.all()
    serializer_class = StatusWriteSerializer

    def put(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            FlightSerializer(
                services.update_flight(self.get_object().pk, serializer.validated_data)
            ).data
        )
