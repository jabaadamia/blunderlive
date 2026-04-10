from django.urls import path

from .views import AccountStatusView

urlpatterns = [
    path("status/", AccountStatusView.as_view(), name="account-status"),
]
