from rest_framework import generics
from rest_framework.response import Response
from common.permissions import IsAdministrator
from django_filters import rest_framework as filters
from .models import Booking
from .serializers import (
    BookingSerializer,
    CreateBookingSerializer,
    UpdateBookingSerializer,
)
from .services import booking_queryset, reserve, cancel, update_passengers


class OwnBookingsMixin:
    def get_queryset(self):
        return booking_queryset().filter(user=self.request.user)


class BookingsView(OwnBookingsMixin, generics.ListCreateAPIView):
    serializer_class = BookingSerializer
    filterset_fields = ["status", "payment_status"]
    ordering_fields = ["created_at", "total_price"]

    def post(self, request, *args, **kwargs):
        serializer = CreateBookingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking, created = reserve(
            request.user,
            serializer.validated_data,
            request.headers.get("Idempotency-Key", ""),
        )
        return Response(
            BookingSerializer(booking_queryset().get(pk=booking.pk)).data,
            status=201 if created else 200,
        )


class BookingDetailView(OwnBookingsMixin, generics.RetrieveAPIView):
    serializer_class = BookingSerializer

    def patch(self, request, *args, **kwargs):
        booking = self.get_object()
        serializer = UpdateBookingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        update_passengers(booking.pk, serializer.validated_data["passengers"])
        return Response(
            self.get_serializer(self.get_queryset().get(pk=booking.pk)).data
        )

    def delete(self, request, *args, **kwargs):
        cancel(self.get_object().pk)
        return Response(status=204)


class CancelBookingView(OwnBookingsMixin, generics.GenericAPIView):
    serializer_class = BookingSerializer

    def post(self, request, *args, **kwargs):
        booking = cancel(self.get_object().pk)
        return Response(BookingSerializer(booking_queryset().get(pk=booking.pk)).data)


class AdminBookingFilter(filters.FilterSet):
    flight = filters.UUIDFilter(field_name="segments__flight_id", distinct=True)
    date = filters.DateFilter(field_name="created_at", lookup_expr="date")

    class Meta:
        model = Booking
        fields = ["status", "payment_status", "user"]


class AdminBookingsView(generics.ListAPIView):
    permission_classes = [IsAdministrator]
    queryset = booking_queryset()
    serializer_class = BookingSerializer
    filterset_class = AdminBookingFilter
    search_fields = ["reference", "user__email"]
    ordering_fields = ["created_at", "total_price"]


class AdminBookingDetailView(BookingDetailView):
    permission_classes = [IsAdministrator]
    queryset = booking_queryset()
    serializer_class = BookingSerializer

    def get_queryset(self):
        return booking_queryset()


class AdminCancelView(CancelBookingView):
    permission_classes = [IsAdministrator]

    def get_queryset(self):
        return booking_queryset()
