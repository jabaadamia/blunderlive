from drf_spectacular.utils import extend_schema
from django.conf import settings
from django.db import connection
from redis import Redis
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework import status


@extend_schema(tags=["health"], summary="Core service liveness")
@api_view(["GET"])
def health_live(request: Request) -> Response:
    return Response({"status": "ok", "service": "core"})


@extend_schema(tags=["health"], summary="Core service readiness")
@api_view(["GET"])
def health_ready(request: Request) -> Response:
    checks = {
        "database": "ok",
        "redis": "ok",
    }

    try:
        connection.ensure_connection()
    except Exception:
        checks["database"] = "error"

    try:
        if not settings.CORE_REDIS_URL:
            raise RuntimeError("REDIS_URL is not configured.")
        redis = Redis.from_url(settings.CORE_REDIS_URL, decode_responses=True)
        try:
            redis.ping()
        finally:
            redis.close()
    except Exception:
        checks["redis"] = "error"

    if any(value != "ok" for value in checks.values()):
        return Response(
            {"status": "error", "service": "core", **checks},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response({"status": "ok", "service": "core", **checks})
