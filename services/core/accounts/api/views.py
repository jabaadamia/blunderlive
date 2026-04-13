from drf_spectacular.utils import extend_schema, OpenApiResponse
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.utils import set_refresh_cookie

from .serializers import AuthStatusSerializer, RegisterInputSerializer


@extend_schema(tags=["auth"], responses=AuthStatusSerializer)
class AuthStatusView(APIView):
    def get(self, request):
        serializer = AuthStatusSerializer({"service": "auth", "status": "ready"})
        return Response(serializer.data)


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(
        tags=["auth"],
        summary="Register",
        request=RegisterInputSerializer,
        responses={
            201: OpenApiResponse(description="Registered successfully, access token returned."),
            400: OpenApiResponse(description="Validation errors."),
        },
    )
    def post(self, request):
        serializer = RegisterInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user) # type: ignore

        response = Response(
            {"access": str(refresh.access_token)},
            status=status.HTTP_201_CREATED,
        )
        set_refresh_cookie(response, refresh)

        return response