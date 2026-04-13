from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    model = User

    list_display = ("email", "username", "is_staff", "is_active", "created_at")
    list_filter = ("is_staff", "is_active")

    ordering = ("-created_at",)
    search_fields = ("email", "username")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal Info", {"fields": ("username",)}),
        ("Permissions", {
            "fields": ("is_active", "is_staff", "groups", "user_permissions"),
        }),
        ("Important Dates", {"fields": ("created_at", "updated_at")}),
    )

    readonly_fields = ("created_at", "updated_at")

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "username", "password1", "password2", "is_staff", "is_active"),
        }),
    )