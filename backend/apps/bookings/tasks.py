from celery import shared_task
from django.utils import timezone
from .models import Booking
from .services import expire


@shared_task(autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def expire_reservations():
    ids = Booking.objects.filter(
        status="Pending", expires_at__lte=timezone.now()
    ).values_list("pk", flat=True)[:500]
    for pk in ids:
        expire(pk)
