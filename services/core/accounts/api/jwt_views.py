from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework_simplejwt.views import (
    TokenObtainPairView as BaseTokenObtainPairView,
    TokenRefreshView as BaseTokenRefreshView,
)

from rest_framework_simplejwt.views import TokenObtainPairView as BaseTokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema_view, extend_schema


@extend_schema_view(
    post=extend_schema(
        tags=["auth"],
        summary="Login (obtain access token + set refresh cookie)",
    ),
)
class LoginView(BaseTokenObtainPairView):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)

        refresh = response.data.pop("refresh", None) # type: ignore
        access = response.data.get("access") # type: ignore

        res = Response({"access": access}, status=status.HTTP_200_OK)

        if refresh:
            res.set_cookie(
                key="refresh",
                value=refresh,
                httponly=True,
                secure=True,
                samesite="Lax",
                path="/api/auth/",
            )

        return res

@extend_schema_view(
    post=extend_schema(
        tags=["auth"],
        summary="Logout (invalidate refresh token)",
    ),
)
class LogoutView(APIView):
    def post(self, request):
        refresh = request.COOKIES.get("refresh")

        if refresh:
            try:
                token = RefreshToken(refresh)
                token.blacklist()
            except Exception:
                # expired / invalid / already blacklisted
                pass

        response = Response(status=204)
        response.delete_cookie("refresh", path="/api/auth/")

        return response

@extend_schema_view(
    post=extend_schema(
        tags=["auth"],
        summary="Refresh access token",
    ),
)
class RefreshView(BaseTokenRefreshView):
    def post(self, request, *args, **kwargs):
        refresh = request.COOKIES.get("refresh")

        if not refresh:
            return Response({"detail": "No refresh token"}, status=401)

        request.data["refresh"] = refresh # type: ignore
        response = super().post(request, *args, **kwargs)

        if "refresh" in response.data: # type: ignore
            new_refresh = response.data.pop("refresh") # type: ignore
            response.set_cookie(
                key="refresh",
                value=new_refresh,
                httponly=True,
                secure=True,
                samesite="Lax",
                path="/api/auth/",
            )

        return response
