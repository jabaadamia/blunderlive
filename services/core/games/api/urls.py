from django.urls import path

from games.api.views import MyGamesView, UserGamesView, GameDetailView 


urlpatterns = [
    path("me/", MyGamesView.as_view(), name="game-history-me"),
    path("users/<uuid:user_id>/", UserGamesView.as_view(), name="game-history-user"),
    path("<uuid:game_id>/", GameDetailView.as_view(), name="game-history-detail"),
]
