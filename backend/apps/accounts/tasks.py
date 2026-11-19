from celery import shared_task
from django.db import transaction
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from .models import Notification


@shared_task(
    autoretry_for=(Exception,), retry_backoff=True, retry_jitter=True, max_retries=5
)
def send_notification(notification_id):
    # Lock prevents concurrent workers delivering the same outbox item.
    # SMTP is at-least-once: a crash after SMTP accepts can still duplicate an email.
    with transaction.atomic():
        item = (
            Notification.objects.select_for_update()
            .select_related("user")
            .get(pk=notification_id)
        )
        if item.sent_at:
            return
        if item.user.approval_status == item.status:
            approved = item.status == "approved"
            message = (
                f"Your Air Booking account is approved. You can now sign in at {settings.FRONTEND_URL}/login."
                if approved
                else "Your Air Booking registration was not approved. Please contact the administrator."
            )
            send_mail(
                "Air Booking account " + item.status,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [item.user.email],
            )
        item.sent_at = timezone.now()
        item.save(update_fields=["sent_at"])


@shared_task
def dispatch_notifications():
    for pk in Notification.objects.filter(sent_at__isnull=True).values_list(
        "pk", flat=True
    )[:100]:
        send_notification.delay(str(pk))
