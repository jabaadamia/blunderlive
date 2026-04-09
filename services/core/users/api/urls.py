from django.urls import path

from .views import UsersStatusView


urlpatterns = [
    path("status/", UsersStatusView.as_view(), name="users-status"),
]
