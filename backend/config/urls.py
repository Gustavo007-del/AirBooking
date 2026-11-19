from django.contrib import admin
from django.urls import path, include
from apps.accounts import views as accounts
from apps.flights import views as flights
from apps.bookings import views as bookings
from common.dashboard import DashboardView
from common.operations import OperationsView
from rest_framework.routers import SimpleRouter
from apps.flights.catalog import (
    PublicAirports,
    PublicDestinations,
    PublicRoutes,
    AdminAirports,
    AdminRoutes,
)

catalog = SimpleRouter()
catalog.register("airports", PublicAirports, basename="airport")
catalog.register("routes", PublicRoutes, basename="route")
catalog.register("destinations", PublicDestinations, basename="destination")
catalog.register("admin/airports", AdminAirports, basename="admin-airport")
catalog.register("admin/routes", AdminRoutes, basename="admin-route")

urlpatterns = [
    path("api/", include(catalog.urls)),
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/flights/", include("apps.flights.urls")),
    path("api/bookings/", include("apps.bookings.urls")),
    path("api/admin/users/", accounts.AdminUsersView.as_view()),
    path(
        "api/admin/users/pending/", accounts.AdminUsersView.as_view(), {"pending": True}
    ),
    path("api/admin/users/<uuid:pk>/", accounts.AdminUserView.as_view()),
    path(
        "api/admin/users/<uuid:pk>/approve/",
        accounts.DecisionView.as_view(),
        {"decision": "approved"},
    ),
    path(
        "api/admin/users/<uuid:pk>/reject/",
        accounts.DecisionView.as_view(),
        {"decision": "rejected"},
    ),
    path("api/admin/flights/", flights.AdminFlightsView.as_view()),
    path("api/admin/flights/<uuid:pk>/", flights.AdminFlightView.as_view()),
    path("api/admin/flights/<uuid:pk>/status/", flights.AdminStatusView.as_view()),
    path("api/admin/bookings/", bookings.AdminBookingsView.as_view()),
    path("api/admin/bookings/<uuid:pk>/", bookings.AdminBookingDetailView.as_view()),
    path("api/admin/bookings/<uuid:pk>/cancel/", bookings.AdminCancelView.as_view()),
    path("api/admin/dashboard/", DashboardView.as_view()),
    path("api/admin/operations/", OperationsView.as_view()),
]
