from rest_framework import generics
from rest_framework.response import Response
from .serializers import FlightStatusSerializer, BookingStatusSerializer
from apps.flights.models import Flight
from apps.bookings.views import OwnBookingsMixin


class FlightStatusView(generics.RetrieveAPIView):
    queryset = Flight.objects.all()
    serializer_class = FlightStatusSerializer


class BookingStatusView(OwnBookingsMixin, generics.GenericAPIView):
    serializer_class = BookingStatusSerializer

    def get(self, request, *args, **kwargs):
        booking = self.get_object()
        return Response(
            self.get_serializer(
                {
                    "id": booking.id,
                    "reference": booking.reference,
                    "status": booking.status,
                    "paymentStatus": booking.payment_status,
                    "flights": [s.flight for s in booking.segments.all()],
                }
            ).data
        )
