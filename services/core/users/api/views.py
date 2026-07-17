from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from users.services import UnknownGamePlayersError, get_game_player_profiles

from .serializers import (
    GamePlayerProfileSerializer,
    GamePlayersLookupRequestSerializer,
    UserSerializer,
    UsersStatusSerializer,
)


@extend_schema(tags=["users"], responses=UsersStatusSerializer)
class UsersStatusView(APIView):
    def get(self, request):
        serializer = UsersStatusSerializer({"service": "users", "status": "ready"})
        return Response(serializer.data)


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(tags=["users"], responses=UserSerializer)
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class GamePlayersLookupView(APIView):
    @extend_schema(
        tags=["users"],
        request=GamePlayersLookupRequestSerializer,
        responses=GamePlayerProfileSerializer(many=True),
    )
    def post(self, request):
        serializer = GamePlayersLookupRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            profiles = get_game_player_profiles(
                user_ids=serializer.validated_data["user_ids"],
                rating_category=serializer.validated_data.get("rating_category"),
            )
        except UnknownGamePlayersError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            GamePlayerProfileSerializer(profiles, many=True).data,
            status=status.HTTP_200_OK,
        )
