from django.contrib import admin

from .models import Rating, RatingHistory


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ("user", "category", "value", "games_played", "last_updated")
    list_filter = ("category",)
    search_fields = ("user__username", "user__email")
    ordering = ("category", "-value")


@admin.register(RatingHistory)
class RatingHistoryAdmin(admin.ModelAdmin):
    list_display = ("rating", "source", "previous_value", "new_value", "delta", "created_at")
    list_filter = ("source", "rating__category")
    search_fields = ("rating__user__username", "rating__user__email", "notes")
    ordering = ("-created_at",)
