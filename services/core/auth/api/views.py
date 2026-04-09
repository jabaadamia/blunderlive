from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import AuthStatusSerializer


class AuthStatusView(APIView):
    def get(self, request):
        serializer = AuthStatusSerializer({"service": "auth", "status": "ready"})
        return Response(serializer.data)
