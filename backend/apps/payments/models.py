import uuid
from django.db import models


class Payment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.OneToOneField(
        "bookings.Booking", on_delete=models.PROTECT, related_name="payment"
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3)
    outcome = models.CharField(
        max_length=12, choices=[("success", "Success"), ("failure", "Failure")]
    )
    simulated = models.BooleanField(default=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
