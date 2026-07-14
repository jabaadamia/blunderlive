import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from ratings.models import RatingCategory


class Result(models.TextChoices):
    WHITE_WIN = "1-0", "1-0"
    BLACK_WIN = "0-1", "0-1"
    DRAW = "1/2-1/2", "1/2-1/2"


class Termination(models.TextChoices):
    CHECKMATE = "checkmate", "Checkmate"
    STALEMATE = "stalemate", "Stalemate"
    DRAW_AGREEMENT = "draw_agreement", "Draw Agreement"
    INSUFFICIENT_MATERIAL = "insufficient_material", "Insufficient Material"
    FIFTY_MOVE_RULE = "fifty_move_rule", "Fifty Move Rule"
    THREEFOLD_REPETITION = "threefold_repetition", "Threefold Repetition"
    RESIGNATION = "resignation", "Resignation"
    TIMEOUT = "timeout", "Timeout"
    ABANDONED = "abandoned", "Abandoned"


class Game(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    white_player = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="white_games",
    )

    black_player = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="black_games",
    )

    result = models.CharField(
        max_length=8,
        choices=Result.choices,
    )

    termination = models.CharField(
        max_length=32,
        choices=Termination.choices,
    )

    rated = models.BooleanField(default=True)
    rating_category = models.CharField(
        max_length=16,
        choices=RatingCategory.choices,
        null=True,
        blank=True,
    )

    initial_time_ms = models.PositiveIntegerField()
    increment_ms = models.PositiveIntegerField(default=0)

    started_at = models.DateTimeField(default=timezone.now, editable=False)
    ended_at = models.DateTimeField()

    move_count = models.PositiveIntegerField(default=0)

    fen_final = models.CharField(max_length=255)

    pgn = models.TextField()

    white_rating_before = models.IntegerField(null=True, blank=True)
    white_rating_after = models.IntegerField(null=True, blank=True)
    white_rating_delta = models.IntegerField(null=True, blank=True)
    black_rating_before = models.IntegerField(null=True, blank=True)
    black_rating_after = models.IntegerField(null=True, blank=True)
    black_rating_delta = models.IntegerField(null=True, blank=True)
    rating_applied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["-started_at", "-id"]),
            models.Index(fields=["white_player"]),
            models.Index(fields=["black_player"]),
            models.Index(fields=["rated", "rating_category"]),
        ]

    @property
    def time_control(self) -> str:
        return f"{self.initial_time_ms // 60000}+{self.increment_ms // 1000}"

    def __str__(self) -> str:
        white = self.white_player.username if self.white_player else "Unknown"
        black = self.black_player.username if self.black_player else "Unknown"

        return f"{self.started_at.date()}: {white} {self.result} {black}"
