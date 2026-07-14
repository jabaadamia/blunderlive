from rest_framework import serializers

from users.api.serializers import PlayerSerializer

from games.models import Game


class GameListSerializer(serializers.ModelSerializer):
    white_player = PlayerSerializer(read_only=True)
    black_player = PlayerSerializer(read_only=True)
    time_control = serializers.ReadOnlyField()

    class Meta:
        model = Game
        fields = [
            "id", "white_player", "black_player", "result", "termination",
            "rated", "rating_category", "time_control", "started_at",
            "ended_at", "move_count",
        ]


class GameDetailSerializer(GameListSerializer):
    class Meta(GameListSerializer.Meta):
        fields = GameListSerializer.Meta.fields + [
            "initial_time_ms", "increment_ms", "fen_final", "pgn",
            "white_rating_before", "white_rating_after", "white_rating_delta",
            "black_rating_before", "black_rating_after", "black_rating_delta",
            "rating_applied_at",
        ]
