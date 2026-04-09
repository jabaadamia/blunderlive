from django.test import Client, TestCase


class UsersStatusViewTests(TestCase):
    def test_users_status_endpoint_returns_ready(self) -> None:
        response = Client().get("/api/users/status/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"service": "users", "status": "ready"})
