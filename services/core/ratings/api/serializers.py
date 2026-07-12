from rest_framework import serializers

from ratings.models import Rating, RatingHistory


class RatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rating
        fields = ["category", "value", "games_played", "deviation", "volatility", "last_updated"]


class RatingHistorySerializer(serializers.ModelSerializer):
    category = serializers.CharField(source="rating.category", read_only=True)
    game_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = RatingHistory
        fields = [
            "category",
            "source",
            "previous_value",
            "new_value",
            "delta",
            "game_id",
            "notes",
            "created_at",
        ]
