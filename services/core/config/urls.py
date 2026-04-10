from django.contrib import admin
from django.urls import include, path

from .views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health, name="health"),
    path("api/accounts/", include("accounts.api.urls")),
    path("api/users/", include("users.api.urls")),
]
