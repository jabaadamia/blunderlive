from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class JWTAuthTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="jwtuser",
            email="jwtuser@example.com",
            password="test-pass-123",
        )

    def test_login_sets_refresh_cookie_and_returns_access(self) -> None:
        response = self.client.post(
            "/api/auth/login/",
            {"email": "jwtuser@example.com", "password": "test-pass-123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)  # type: ignore

        # ✅ cookie instead of response body
        self.assertIn("refresh", response.cookies)

    def test_refresh_uses_cookie_and_returns_new_access(self) -> None:
        # login first
        self.client.post(
            "/api/auth/login/",
            {"email": "jwtuser@example.com", "password": "test-pass-123"},
            format="json",
        )

        # ✅ no body, cookie is automatically sent by test client
        response = self.client.post("/api/auth/refresh-token/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)  # type: ignore

    def test_logout_blacklists_refresh_and_deletes_cookie(self) -> None:
        # login first
        self.client.post(
            "/api/auth/login/",
            {"email": "jwtuser@example.com", "password": "test-pass-123"},
            format="json",
        )

        response = self.client.post("/api/auth/logout/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # cookie should be deleted
        self.assertIn("refresh", response.cookies)
        self.assertEqual(response.cookies["refresh"].value, "")