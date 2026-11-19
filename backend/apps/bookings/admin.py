from django.contrib import admin
from .models import Booking, BookingSegment, Passenger


class ReadOnlyAdmin(admin.ModelAdmin):
    def get_readonly_fields(self, request, obj=None):
        return [f.name for f in self.model._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Booking)
class BookingAdmin(ReadOnlyAdmin):
    list_display = (
        "reference",
        "user",
        "status",
        "payment_status",
        "total_price",
        "created_at",
    )
    list_filter = ("status", "payment_status")
    search_fields = ("reference", "user__email")
    list_select_related = ("user",)


@admin.register(BookingSegment)
class SegmentAdmin(ReadOnlyAdmin):
    list_display = ("booking", "order", "flight", "unit_price")
    list_select_related = ("booking", "flight")


@admin.register(Passenger)
class PassengerAdmin(ReadOnlyAdmin):
    list_display = ("first_name", "last_name", "booking")
    search_fields = ("booking__reference", "last_name")
