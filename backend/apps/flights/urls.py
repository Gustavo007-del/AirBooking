from django.urls import path
from .views import SearchView, FlightDetailView
from apps.flight_tracking.views import FlightStatusView
from apps.flight_tracking.live import LiveFlightLookup, LiveScheduleView

urlpatterns = [
    path("search/", SearchView.as_view()),
    path("live-status/", LiveFlightLookup.as_view()),
    path("schedules/", LiveScheduleView.as_view()),
    path("<uuid:pk>/", FlightDetailView.as_view()),
    path("<uuid:pk>/status/", FlightStatusView.as_view()),
]
