from rest_framework import serializers


class UsersStatusSerializer(serializers.Serializer):
    service = serializers.CharField()
    status = serializers.CharField()
