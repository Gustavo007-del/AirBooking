from rest_framework.permissions import BasePermission


def eligible(user):
    return bool(
        user
        and user.is_authenticated
        and user.is_active
        and (user.is_staff or user.approval_status == "approved")
    )


class IsApproved(BasePermission):
    message = "An active, approved account is required."

    def has_permission(self, request, view):
        return eligible(request.user)


class IsAdministrator(IsApproved):
    message = "Administrator access is required."

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.is_staff
