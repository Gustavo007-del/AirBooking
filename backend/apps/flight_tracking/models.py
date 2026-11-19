from django.db import models


class StatusEvent(models.Model):
    flight = models.ForeignKey(
        "flights.Flight", on_delete=models.CASCADE, related_name="status_events"
    )
    status = models.CharField(max_length=16)
    source = models.CharField(max_length=24)
    observed_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-observed_at"]
