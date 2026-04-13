from django.urls import path

from .views import AuthStatusView, RegisterView
from .jwt_views import (
    LoginView,
    LogoutView,
    RefreshView,
)

urlpatterns = [
    path("status/", AuthStatusView.as_view(), name="auth-status"),
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("refresh-token/", RefreshView.as_view(), name="refresh-token"),
]
