from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import AccountStatusSerializer


class AccountStatusView(APIView):
    def get(self, request):
        serializer = AccountStatusSerializer({"service": "accounts", "status": "ready"})
        return Response(serializer.data)
