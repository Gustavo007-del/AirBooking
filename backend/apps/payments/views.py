from rest_framework import generics
from rest_framework.response import Response
from apps.bookings.services import booking_queryset
from apps.bookings.serializers import BookingSerializer
from .serializers import PaymentRequestSerializer
from .services import simulate


class PaymentView(generics.GenericAPIView):
    serializer_class = PaymentRequestSerializer

    def get_queryset(self):
        qs = booking_queryset()
        return qs if self.request.user.is_staff else qs.filter(user=self.request.user)

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking, error = simulate(
            self.get_object().pk, serializer.validated_data["outcome"]
        )
        if error:
            return Response(
                {"detail": error, "code": "reservation_unavailable", "errors": {}},
                status=409,
            )
        return Response(BookingSerializer(booking_queryset().get(pk=booking.pk)).data)
