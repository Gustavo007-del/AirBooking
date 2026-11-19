from django.contrib import admin
from apps.bookings.admin import ReadOnlyAdmin
from .models import StatusEvent


@admin.register(StatusEvent)
class StatusAdmin(ReadOnlyAdmin):
    list_display = ("flight", "status", "source", "observed_at")
    list_filter = ("source", "status")
    search_fields = ("flight__number",)
    list_select_related = ("flight",)
