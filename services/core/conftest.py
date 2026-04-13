import pytest
from rest_framework.test import APIClient
from users.models import User


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user( # type: ignore
        username="testuser",
        email="test@example.com",
        password="securepass123",
    )


@pytest.fixture
def logged_in_client(client, user):
    client.post(
        "/api/auth/login/",
        {"email": "test@example.com", "password": "securepass123"},
        format="json",
    )
    return client