from django.db import transaction
from django.conf import settings
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework.exceptions import ValidationError
from common.permissions import IsAdministrator, IsApproved
from common.authentication import ApprovedJWTAuthentication
from .models import User
from .serializers import (
    UserSerializer,
    RegistrationSerializer,
    LoginSerializer,
    ApprovedRefreshSerializer,
    LogoutSerializer,
    ProfileSerializer,
    AdminUserUpdateSerializer,
)
from . import services

SESSION_COOKIE = "air_booking_session"
SESSION_PATH = "/api/auth/"


def set_session_cookie(response, token):
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(api_settings.REFRESH_TOKEN_LIFETIME.total_seconds()),
        httponly=True,
        secure=not settings.DEBUG,
        samesite="Strict",
        path=SESSION_PATH,
    )
    response["Cache-Control"] = "no-store"
    return response


class RegisterView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = RegistrationSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.register(serializer.validated_data)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def get_authenticate_header(self, request):
        return "Bearer"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = Response(serializer.validated_data)
        if request.headers.get("X-Air-Session") == "1":
            set_session_cookie(response, serializer.validated_data["refresh"])
        return response


class BrowserSessionView(generics.GenericAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "refresh"
    serializer_class = ApprovedRefreshSerializer

    def post(self, request):
        token = request.COOKIES.get(SESSION_COOKIE)
        if request.headers.get("X-Air-Session") != "1":
            return Response(status=403)
        if not token:
            return Response(status=204)
        try:
            user_id = RefreshToken(token)["user_id"]
            serializer = self.get_serializer(data={"refresh": token})
            serializer.is_valid(raise_exception=True)
        except TokenError:
            return Response(
                {"detail": "Your session has expired. Sign in again."}, status=401
            )
        data = serializer.validated_data
        response = Response(
            {
                "access": data["access"],
                "user": UserSerializer(User.objects.get(pk=user_id)).data,
            }
        )
        return set_session_cookie(response, data.get("refresh", token))

    def delete(self, request):
        if request.headers.get("X-Air-Session") != "1":
            return Response(status=403)
        token = request.COOKIES.get(SESSION_COOKIE)
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass
        response = Response(status=204)
        response.delete_cookie(SESSION_COOKIE, path=SESSION_PATH, samesite="Strict")
        return response


class RefreshView(TokenRefreshView):
    authentication_classes = [ApprovedJWTAuthentication]
    permission_classes = [IsApproved]
    serializer_class = ApprovedRefreshSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "refresh"

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "require_matching_user": True}


class VerifyView(TokenVerifyView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "refresh"


class LogoutView(generics.GenericAPIView):
    serializer_class = LogoutSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            token = RefreshToken(serializer.validated_data["refresh"])
            if str(token.get("user_id")) != str(request.user.pk):
                raise ValidationError("The refresh token does not belong to this user.")
            token.blacklist()
        except TokenError:
            raise ValidationError("The refresh token is invalid or already revoked.")
        return Response(status=204)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

    def patch(self, request, *args, **kwargs):
        serializer = ProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)

    http_method_names = ["get", "patch", "head", "options"]


class AdminUsersView(generics.ListAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = UserSerializer
    queryset = User.objects.order_by("-date_joined", "id")
    filterset_fields = ["approval_status", "is_active"]
    search_fields = ["email", "name"]
    ordering_fields = ["date_joined", "name"]

    def get_queryset(self):
        qs = super().get_queryset()
        return (
            qs.filter(approval_status="pending") if self.kwargs.get("pending") else qs
        )


class AdminUserView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = UserSerializer
    queryset = User.objects.all()
    http_method_names = ["get", "patch", "head", "options"]

    def patch(self, request, *args, **kwargs):
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=self.get_object().pk)
            if user.is_staff:
                raise ValidationError(
                    "Manage administrator accounts through the protected Django admin."
                )
            serializer = AdminUserUpdateSerializer(
                user, data=request.data, partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
        return Response(UserSerializer(user).data)


class DecisionView(generics.GenericAPIView):
    permission_classes = [IsAdministrator]
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def post(self, request, *args, **kwargs):
        user = self.get_object()
        return Response(
            UserSerializer(services.decide(user.pk, kwargs["decision"])).data
        )
