from rest_framework import serializers


class AccountStatusSerializer(serializers.Serializer):
    service = serializers.CharField()
    status = serializers.CharField()
