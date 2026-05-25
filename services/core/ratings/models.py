import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class RatingCategory(models.TextChoices):
    BULLET = "bullet", "Bullet"
    BLITZ = "blitz", "Blitz"
    RAPID = "rapid", "Rapid"
    PUZZLE = "puzzle", "Puzzle"


class RatingHistorySource(models.TextChoices):
    GAME = "game", "Game"
    PUZZLE = "puzzle", "Puzzle"
    ADMIN = "admin", "Admin"
    SYSTEM = "system", "System"


class Rating(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="rating_entries",
    )
    category = models.CharField(max_length=16, choices=RatingCategory.choices)
    value = models.IntegerField(default=1200)
    games_played = models.IntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)
    deviation = models.FloatField(null=True, blank=True)
    volatility = models.FloatField(null=True, blank=True)

    class Meta:
        unique_together = ("user", "category")
        indexes = [models.Index(fields=["category", "value"])]
        ordering = ["category"]

    def __str__(self) -> str:
        return f"{self.user.username} - {self.category}: {self.value}"


class RatingHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rating = models.ForeignKey(Rating, on_delete=models.CASCADE, related_name="history")
    source = models.CharField(max_length=16, choices=RatingHistorySource.choices)
    previous_value = models.IntegerField()
    new_value = models.IntegerField()
    delta = models.IntegerField()
    opponent_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rating_history_as_opponent",
    )
    game = models.ForeignKey(
        "games.Game",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rating_history_entries",
    )
    notes = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["source", "created_at"]),
            models.Index(fields=["game"]),
        ]

    def __str__(self) -> str:
        return f"{self.rating.user.username} {self.delta:+d} ({self.source})"
