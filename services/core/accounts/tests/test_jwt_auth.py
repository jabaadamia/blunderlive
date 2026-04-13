import pytest
from django.urls import reverse


LOGIN_URL = reverse("login")
REFRESH_URL = reverse("refresh-token")
LOGOUT_URL = reverse("logout")


@pytest.mark.django_db
class TestJWTAuth:

    def test_login_returns_access_token(self, client, user):
        response = client.post(
            LOGIN_URL,
            {"email": user.email, "password": "securepass123"},
            format="json",
        )

        assert response.status_code == 200
        assert "access" in response.data

    def test_login_sets_refresh_cookie(self, client, user):
        response = client.post(
            LOGIN_URL,
            {"email": user.email, "password": "securepass123"},
            format="json",
        )

        assert "refresh" in response.cookies
        cookie = response.cookies["refresh"]
        assert cookie["httponly"]
        assert cookie["path"] == "/api/auth/"
        assert cookie["samesite"] == "Lax"

    def test_refresh_returns_new_access_token(self, logged_in_client):
        response = logged_in_client.post(REFRESH_URL)

        assert response.status_code == 200
        assert "access" in response.data

    def test_refresh_without_cookie_fails(self, client):
        response = client.post(REFRESH_URL)

        assert response.status_code == 401

    def test_logout_deletes_cookie(self, logged_in_client):
        response = logged_in_client.post(LOGOUT_URL)

        assert response.status_code == 204
        assert response.cookies["refresh"].value == ""

    def test_logout_blacklists_token(self, logged_in_client):
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

        logged_in_client.post(LOGOUT_URL)

        assert BlacklistedToken.objects.exists()

    def test_refresh_after_logout_fails(self, logged_in_client):
        logged_in_client.post(LOGOUT_URL)
        response = logged_in_client.post(REFRESH_URL)

        assert response.status_code == 401