from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from .models import User, Notification
from .services import decide


class CreateUserForm(UserCreationForm):
    class Meta:
        model = User
        fields = ("email", "name")


class ChangeUserForm(UserChangeForm):
    class Meta:
        model = User
        fields = "__all__"


@admin.register(User)
class AccountAdmin(UserAdmin):
    add_form = CreateUserForm
    form = ChangeUserForm
    ordering = ("email",)
    list_display = ("email", "name", "approval_status", "is_active", "is_staff")
    list_filter = ("approval_status", "is_active", "is_staff")
    search_fields = ("email", "name")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("name", "phone", "approval_status")}),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Dates", {"fields": ("date_joined", "last_login")}),
    )
    readonly_fields = ("approval_status", "date_joined", "last_login")
    add_fieldsets = ((None, {"fields": ("email", "name", "password1", "password2")}),)
    actions = ["approve_accounts", "reject_accounts"]

    @admin.action(description="Approve selected accounts and queue email")
    def approve_accounts(self, request, queryset):
        for user in queryset.filter(is_staff=False):
            decide(user.pk, "approved")

    @admin.action(description="Reject selected accounts and queue email")
    def reject_accounts(self, request, queryset):
        for user in queryset.filter(is_staff=False):
            decide(user.pk, "rejected")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "status", "created_at", "sent_at")
    readonly_fields = ("user", "status", "created_at", "sent_at")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
