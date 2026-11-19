from django.urls import path
from . import views

urlpatterns = [
    path("session/", views.BrowserSessionView.as_view()),
    path("register/", views.RegisterView.as_view()),
    path("login/", views.LoginView.as_view()),
    path("token/refresh/", views.RefreshView.as_view()),
    path("token/verify/", views.VerifyView.as_view()),
    path("logout/", views.LogoutView.as_view()),
    path("me/", views.MeView.as_view()),
]
