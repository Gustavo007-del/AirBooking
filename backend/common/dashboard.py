from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from datetime import timedelta
from rest_framework import generics, serializers
from rest_framework.response import Response
from common.permissions import IsAdministrator
from apps.accounts.models import User
from apps.flights.models import Airport, Flight, Route
from apps.bookings.models import Booking, BookingSegment
from apps.payments.models import Payment


class DashboardSerializer(serializers.Serializer):
    total_users = serializers.IntegerField()
    pending_users = serializers.IntegerField()
    approved_users = serializers.IntegerField()
    rejected_users = serializers.IntegerField()
    total_flights = serializers.IntegerField()
    total_bookings = serializers.IntegerField()
    confirmed_bookings = serializers.IntegerField()
    pending_bookings = serializers.IntegerField()
    successful_simulated_payments = serializers.IntegerField()
    totals_by_currency = serializers.ListField(child=serializers.DictField())
    total_airports = serializers.IntegerField()
    active_routes = serializers.IntegerField()
    upcoming_flights = serializers.IntegerField()
    cancelled_bookings = serializers.IntegerField()
    charts = serializers.DictField(
        child=serializers.ListField(child=serializers.DictField())
    )


class DashboardView(generics.GenericAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = DashboardSerializer

    def get(self, request):
        customers = User.objects.filter(is_staff=False)
        users = customers.aggregate(
            total_users=Count("id"),
            pending_users=Count("id", filter=Q(approval_status="pending")),
            approved_users=Count("id", filter=Q(approval_status="approved")),
            rejected_users=Count("id", filter=Q(approval_status="rejected")),
        )
        bookings = Booking.objects.aggregate(
            total_bookings=Count("id"),
            confirmed_bookings=Count("id", filter=Q(status="Confirmed")),
            pending_bookings=Count("id", filter=Q(status="Pending")),
            cancelled_bookings=Count("id", filter=Q(status="Cancelled")),
        )
        payments = Payment.objects.filter(outcome="success")
        net = payments.filter(booking__payment_status="Simulated")
        now = timezone.now()
        start = now - timedelta(days=30)

        def counts(queryset, field):
            return list(
                queryset.order_by()
                .values(field)
                .annotate(value=Count("pk"))
                .order_by(field)
            )

        def timeline(queryset, field):
            return counts(
                queryset.filter(**{f"{field}__gte": start}).annotate(
                    day=TruncDate(field)
                ),
                "day",
            )

        return Response(
            {
                **users,
                **bookings,
                "total_flights": Flight.objects.count(),
                "total_airports": Airport.objects.count(),
                "active_routes": Route.objects.filter(
                    active=True, origin__active=True, destination__active=True
                ).count(),
                "upcoming_flights": Flight.objects.filter(
                    departure_datetime__gte=now,
                    status__in=["Scheduled", "On time", "Delayed"],
                ).count(),
                "charts": {
                    "bookings": timeline(Booking.objects.all(), "created_at"),
                    "registrations": timeline(customers, "date_joined"),
                    "revenue": list(
                        net.filter(created_at__gte=start)
                        .annotate(day=TruncDate("created_at"))
                        .values("day", "currency")
                        .annotate(value=Sum("amount"))
                        .order_by("day", "currency")
                    ),
                    "flight_status": counts(Flight.objects.all(), "status"),
                    "booking_status": counts(Booking.objects.all(), "status"),
                    "popular_routes": list(
                        BookingSegment.objects.filter(booking__status="Confirmed")
                        .order_by()
                        .values("flight__origin", "flight__destination")
                        .annotate(value=Count("pk"))
                        .order_by("-value", "flight__origin", "flight__destination")[:8]
                    ),
                },
                "successful_simulated_payments": payments.count(),
                "totals_by_currency": list(
                    net.values("currency")
                    .annotate(total=Sum("amount"))
                    .order_by("currency")
                ),
            }
        )
