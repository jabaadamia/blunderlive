import pytest


@pytest.fixture
def register_payload():
    return {
        "username": "newuser",
        "email": "newuser@example.com",
        "password": "securepass123",
        "password_confirm": "securepass123",
    }