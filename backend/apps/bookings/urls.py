from django.urls import path
from . import views
from apps.payments.views import PaymentView
from apps.flight_tracking.views import BookingStatusView

urlpatterns = [
    path("", views.BookingsView.as_view()),
    path("<uuid:pk>/", views.BookingDetailView.as_view()),
    path("<uuid:pk>/payment/", PaymentView.as_view()),
    path("<uuid:pk>/cancel/", views.CancelBookingView.as_view()),
    path("<uuid:pk>/status/", BookingStatusView.as_view()),
]
