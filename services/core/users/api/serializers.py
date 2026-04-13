from rest_framework import serializers
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
