from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import AccountStatusSerializer


@extend_schema(tags=["accounts"], responses=AccountStatusSerializer)
class AccountStatusView(APIView):
    def get(self, request):
        serializer = AccountStatusSerializer({"service": "accounts", "status": "ready"})
        return Response(serializer.data)
