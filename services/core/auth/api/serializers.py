from rest_framework import serializers


class AuthStatusSerializer(serializers.Serializer):
    service = serializers.CharField()
    status = serializers.CharField()
