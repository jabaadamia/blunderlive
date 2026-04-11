from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response


@extend_schema(tags=["health"], summary="Core service liveness")
@api_view(["GET"])
def health(request: Request) -> Response:
    return Response({"status": "ok", "service": "core"})
