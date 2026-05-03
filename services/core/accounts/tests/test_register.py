import pytest
from django.urls import reverse
from ratings.models import Rating, RatingCategory
from users.models import User
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken


REGISTER_URL = reverse("register")


@pytest.mark.django_db
class TestRegisterView:

    def test_success_returns_access_token(self, client, register_payload):
        response = client.post(REGISTER_URL, register_payload)

        assert response.status_code == 201
        assert "access" in response.data

    def test_refresh_token_not_in_body(self, client, register_payload):
        response = client.post(REGISTER_URL, register_payload)

        assert "refresh" not in response.data

    def test_refresh_token_set_in_cookie(self, client, register_payload):
        response = client.post(REGISTER_URL, register_payload)

        assert "refresh" in response.cookies
        cookie = response.cookies["refresh"]
        assert cookie["httponly"]
        assert cookie["path"] == "/api/auth/"
        assert cookie["samesite"] == "Lax"

    def test_user_created_in_db(self, client, register_payload):
        client.post(REGISTER_URL, register_payload)

        assert User.objects.filter(email=register_payload["email"]).exists()

    def test_password_is_hashed(self, client, register_payload):
        client.post(REGISTER_URL, register_payload)

        user = User.objects.get(email=register_payload["email"])
        assert user.check_password(register_payload["password"])
        assert user.password != register_payload["password"]

    def test_outstanding_token_created(self, client, register_payload):
        client.post(REGISTER_URL, register_payload)

        user = User.objects.get(email=register_payload["email"])
        assert OutstandingToken.objects.filter(user=user).exists()

    def test_duplicate_email_fails(self, client, user, register_payload):
        payload = {**register_payload, "email": user.email}
        response = client.post(REGISTER_URL, payload)

        assert response.status_code == 400
        assert "email" in response.data

    def test_duplicate_username_fails(self, client, user, register_payload):
        payload = {**register_payload, "username": user.username}
        response = client.post(REGISTER_URL, payload)

        assert response.status_code == 400
        assert "username" in response.data

    def test_passwords_do_not_match(self, client, register_payload):
        payload = {**register_payload, "password_confirm": "wrongpassword"}
        response = client.post(REGISTER_URL, payload)

        assert response.status_code == 400
        assert "password" in response.data

    def test_password_too_short(self, client, register_payload):
        payload = {**register_payload, "password": "short", "password_confirm": "short"}
        response = client.post(REGISTER_URL, payload)

        assert response.status_code == 400
        assert "password" in response.data

    def test_missing_email(self, client, register_payload):
        payload = {**register_payload, "email": ""}
        response = client.post(REGISTER_URL, payload)

        assert response.status_code == 400
        assert "email" in response.data

    def test_missing_username(self, client, register_payload):
        payload = {**register_payload, "username": ""}
        response = client.post(REGISTER_URL, payload)

        assert response.status_code == 400
        assert "username" in response.data

    def test_invalid_email_format(self, client, register_payload):
        payload = {**register_payload, "email": "notanemail"}
        response = client.post(REGISTER_URL, payload)

        assert response.status_code == 400
        assert "email" in response.data

    def test_register_creates_default_ratings_for_user(self, client, register_payload):
        response = client.post(REGISTER_URL, register_payload)

        assert response.status_code == 201

        user = User.objects.get(email=register_payload["email"])
        created_categories = set(
            Rating.objects.filter(user=user).values_list("category", flat=True)
        )

        assert created_categories == set(RatingCategory.values)
