from drf_spectacular.utils import extend_schema
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import UserSerializer, UsersStatusSerializer


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
