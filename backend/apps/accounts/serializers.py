from django.conf import settings
from django.contrib.auth import authenticate, password_validation
from django.contrib.auth.models import update_last_login
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from common.permissions import eligible
from .models import User


class UserSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True, format="hex_verbose")
    status = serializers.CharField(source="approval_status", read_only=True)
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "name",
            "email",
            "phone",
            "status",
            "role",
            "is_active",
            "date_joined",
        ]
        read_only_fields = fields

    def get_role(self, obj) -> str:
        return "admin" if obj.is_staff else "user"


class RegistrationSerializer(serializers.Serializer):
    name = serializers.CharField(min_length=2, max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True,
        min_length=settings.PASSWORD_MIN_LENGTH,
        max_length=128,
        trim_whitespace=False,
    )
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        return value

    def validate(self, attrs):
        try:
            password_validation.validate_password(
                attrs["password"], User(email=attrs["email"], name=attrs["name"])
            )
        except DjangoValidationError as error:
            raise serializers.ValidationError({"password": error.messages})
        return attrs


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            email=attrs["email"].strip().lower(),
            password=attrs["password"],
        )
        if user is None:
            raise AuthenticationFailed(
                "Invalid email or password, or the account is inactive."
            )
        if not eligible(user):
            raise AuthenticationFailed(
                f"Your account is {user.approval_status}. Administrator approval is required."
            )
        refresh = RefreshToken.for_user(user)
        update_last_login(None, user)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data,
        }


class ApprovedRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        token = self.token_class(attrs["refresh"])
        user = User.objects.filter(pk=token.get("user_id")).first()
        if not eligible(user):
            raise AuthenticationFailed("This account cannot refresh its session.")
        if (
            self.context.get("require_matching_user")
            and user.pk != self.context["request"].user.pk
        ):
            raise AuthenticationFailed(
                "The refresh token belongs to a different account."
            )
        return super().validate(attrs)


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["name", "phone"]


class AdminUserUpdateSerializer(ProfileSerializer):
    class Meta(ProfileSerializer.Meta):
        fields = ["name", "phone", "is_active"]
