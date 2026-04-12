from django.urls import path

from .views import AuthStatusView
from .jwt_views import (
    LoginView,
    LogoutView,
    RefreshView,
)

urlpatterns = [
    path("status/", AuthStatusView.as_view(), name="auth-status"),
    # JWT auth endpoints
    path("login/", LoginView.as_view(), name="login"),
    path("refresh-token/", RefreshView.as_view(), name="refresh-token"),
    path("logout/", LogoutView.as_view(), name="logout"),
]
