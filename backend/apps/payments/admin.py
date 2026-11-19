from django.contrib import admin
from apps.bookings.admin import ReadOnlyAdmin
from .models import Payment


@admin.register(Payment)
class PaymentAdmin(ReadOnlyAdmin):
    list_display = (
        "id",
        "booking",
        "amount",
        "currency",
        "outcome",
        "simulated",
        "created_at",
    )
    list_filter = ("outcome", "currency")
    search_fields = ("booking__reference",)
    list_select_related = ("booking",)
