from django.test import Client, TestCase


class AuthStatusViewTests(TestCase):
    def test_auth_status_endpoint_returns_ready(self) -> None:
        response = Client().get("/api/auth/status/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"service": "auth", "status": "ready"})
