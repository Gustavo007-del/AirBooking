from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .permissions import eligible


class ApprovedJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not eligible(user):
            raise AuthenticationFailed(
                "Your account is no longer approved.", code="account_unavailable"
            )
        return user
