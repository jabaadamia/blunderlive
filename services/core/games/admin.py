from django.contrib import admin

from games.models import Game


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "started_at",
        "white_player",
        "black_player",
        "result",
        "termination",
        "rated",
        "rating_category",
        "move_count",
        "time_control",
        "white_rating_delta",
        "black_rating_delta",
        "rating_applied_at",
    ]
    list_filter = [
        "rated",
        "rating_category",
        "result",
        "termination",
        "started_at",
        "rating_applied_at",
    ]
    search_fields = [
        "id",
        "white_player__username",
        "white_player__email",
        "black_player__username",
        "black_player__email",
        "pgn",
    ]
    readonly_fields = [
        "id",
        "started_at",
        "white_rating_before",
        "white_rating_after",
        "white_rating_delta",
        "black_rating_before",
        "black_rating_after",
        "black_rating_delta",
        "rating_applied_at",
    ]
    autocomplete_fields = [
        "white_player",
        "black_player",
    ]
    ordering = ["-started_at"]
