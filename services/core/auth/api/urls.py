from django.urls import path

from .views import AuthStatusView

urlpatterns = [
    path("status/", AuthStatusView.as_view(), name="auth-status"),
]
