from drf_spectacular.utils import OpenApiParameter, extend_schema
from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import User
from ratings.models import RatingCategory

from games.models import Game
from games.api.serializers import GameDetailSerializer, GameListSerializer
from games.api.pagination import GameCursorPagination
from games.selectors import get_games_for_user


CATEGORY_QUERY_PARAM = OpenApiParameter(
    name="category",
    type=str,
    location=OpenApiParameter.QUERY,
    required=False,
    enum=[choice[0] for choice in RatingCategory.choices],
)

class MyGamesView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = GameCursorPagination

    @extend_schema(
        tags=["games"],
        parameters=[CATEGORY_QUERY_PARAM],
        responses=GameListSerializer(many=True),
    )
    def get(self, request):
        category = request.query_params.get("category")
        games = get_games_for_user(request.user, category=category)
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(games, request)
        serializer = GameListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class UserGamesView(APIView):
    permission_classes = [permissions.AllowAny]
    pagination_class = GameCursorPagination

    @extend_schema(
        tags=["games"],
        parameters=[CATEGORY_QUERY_PARAM],
        responses=GameListSerializer(many=True),
    )
    def get(self, request, user_id):
        user = get_object_or_404(User, pk=user_id)
        category = request.query_params.get("category")
        games = get_games_for_user(user, category=category)
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(games, request)
        serializer = GameListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class GameDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(tags=["games"], responses=GameDetailSerializer)
    def get(self, request, game_id):
        game = get_object_or_404(
            Game.objects.select_related("white_player", "black_player"),
            pk=game_id,
        )
        return Response(GameDetailSerializer(game).data)
