from django.contrib import admin
from .models import Rating

@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ("user", "category", "value", "games_played")
    list_filter = ("category",)

    ordering = ("value",)