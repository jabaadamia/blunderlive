from django.conf import settings


def set_refresh_cookie(response, refresh_token):
    response.set_cookie(
        key="refresh",
        value=str(refresh_token),
        httponly=True,
        secure=not settings.DEBUG, # type: ignore
        samesite="Lax",
        path="/api/auth/",
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()), # type: ignore
    )