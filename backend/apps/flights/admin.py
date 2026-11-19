from django.contrib import admin
from .models import Flight


@admin.register(Flight)
class FlightAdmin(admin.ModelAdmin):
    list_display = (
        "number",
        "origin",
        "destination",
        "departure_datetime",
        "available_seats",
        "status",
    )
    list_filter = ("status", "origin", "destination")
    search_fields = ("number", "airline")
    readonly_fields = [f.name for f in Flight._meta.fields]

    # All writes must use locking and validation in the management API.
    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
