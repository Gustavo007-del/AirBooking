import logging
from django.conf import settings
from django.db import transaction, IntegrityError
from rest_framework.exceptions import ValidationError
from .models import User, Notification

logger = logging.getLogger(__name__)


def register(data):
    try:
        with transaction.atomic():
            return User.objects.create_user(**data)
    except IntegrityError:
        raise ValidationError({"email": "This email is already registered."})


def enqueue_notification(notification_id):
    from .tasks import send_notification

    try:
        send_notification.apply_async(args=[str(notification_id)], retry=False)
    except Exception:
        logger.exception("Notification queue unavailable; outbox will retry")


@transaction.atomic
def decide(user_id, status):
    user = User.objects.select_for_update().get(pk=user_id)
    if user.is_staff:
        raise ValidationError("Administrator approval cannot be changed here.")
    if user.approval_status == status:
        return user
    user.approval_status = status
    user.save(update_fields=["approval_status"])
    if status == "approved" or settings.SEND_REJECTION_EMAIL:
        notification = Notification.objects.create(user=user, status=status)
        transaction.on_commit(lambda: enqueue_notification(notification.id))
    return user
