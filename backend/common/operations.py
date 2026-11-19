from django.conf import settings
from django.db.models import Count, F, Q
from django.utils import timezone
from rest_framework import generics, serializers
from rest_framework.response import Response

from apps.accounts.models import Notification, User
from apps.accounts.serializers import UserSerializer
from apps.bookings.models import Booking
from apps.flights.models import Flight
from apps.flights.timetable import SOURCE
from common.permissions import IsAdministrator


class RecentBookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ("id", "reference", "status", "payment_status", "created_at")


class OperationsSerializer(serializers.Serializer):
    pending_approvals = serializers.IntegerField()
    active_reservations = serializers.IntegerField()
    airlabs_departures = serializers.IntegerField()
    saved_departures = serializers.IntegerField()
    approval_queue = UserSerializer(many=True)
    recent_bookings = RecentBookingSerializer(many=True)
    airlabs_configured = serializers.BooleanField()
    airlabs_status_enabled = serializers.BooleanField()
    email_mode = serializers.ChoiceField(choices=["console", "smtp", "other"])
    email_inline = serializers.BooleanField()
    queued_emails = serializers.IntegerField()


class OperationsView(generics.GenericAPIView):
    permission_classes = (IsAdministrator,)
    serializer_class = OperationsSerializer

    def get(self, request):
        now = timezone.now()
        pending = User.objects.filter(is_staff=False, approval_status="pending")
        departures = Flight.objects.filter(
            departure_datetime__gte=now, status__in=["Scheduled", "On time", "Delayed"]
        ).aggregate(
            airlabs_departures=Count("pk", filter=Q(schedule_source=SOURCE)),
            saved_departures=Count("pk", filter=~Q(schedule_source=SOURCE)),
        )
        email_mode = {
            "django.core.mail.backends.console.EmailBackend": "console",
            "django.core.mail.backends.smtp.EmailBackend": "smtp",
        }.get(settings.EMAIL_BACKEND, "other")
        return Response(
            self.get_serializer(
                {
                    **departures,
                    "pending_approvals": pending.count(),
                    "active_reservations": Booking.objects.filter(
                        status="Pending", expires_at__gt=now
                    ).count(),
                    "approval_queue": pending.order_by("date_joined", "pk")[:5],
                    "recent_bookings": Booking.objects.all()[:5],
                    "airlabs_configured": bool(settings.AIRLABS_API_KEY),
                    "airlabs_status_enabled": bool(settings.AIRLABS_API_KEY)
                    and settings.FLIGHT_STATUS_PROVIDER == "airlabs",
                    "email_mode": email_mode,
                    "email_inline": settings.CELERY_TASK_ALWAYS_EAGER,
                    "queued_emails": Notification.objects.filter(
                        sent_at__isnull=True, status=F("user__approval_status")
                    ).count(),
                }
            ).data
        )
