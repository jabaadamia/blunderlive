from django.urls import path

from .views import CurrentUserView, GamePlayersLookupView, UsersStatusView


urlpatterns = [
    path("status/", UsersStatusView.as_view(), name="users-status"),
    path("me/", CurrentUserView.as_view(), name="users-me"),
    path("game-players/", GamePlayersLookupView.as_view(), name="users-game-players"),
]
