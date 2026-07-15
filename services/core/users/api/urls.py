from django.urls import path

from .views import CurrentUserView, UsersStatusView


urlpatterns = [
    path("status/", UsersStatusView.as_view(), name="users-status"),
    path("me/", CurrentUserView.as_view(), name="users-me"),
]
