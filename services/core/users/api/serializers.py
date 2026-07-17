from rest_framework import serializers

from ratings.models import RatingCategory
from users.models import User

class UsersStatusSerializer(serializers.Serializer):
    service = serializers.CharField()
    status = serializers.CharField()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "created_at",
            "updated_at",
            "is_active",
            "is_staff",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class PlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username"]


class GamePlayersLookupRequestSerializer(serializers.Serializer):
    user_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        max_length=20,
    )
    rating_category = serializers.ChoiceField(
        choices=RatingCategory.choices,
        required=False,
        allow_null=True,
    )


class GamePlayerProfileSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    username = serializers.CharField()
    rating = serializers.IntegerField(allow_null=True)
