from django.db import models

class RatingCategory(models.TextChoices):
    BULLET = "bullet"
    BLITZ = "blitz"
    RAPID = "rapid"
    PUZZLE = "puzzle"


class Rating(models.Model):
    user = models.ForeignKey("users.User", on_delete=models.CASCADE)
    category = models.CharField(max_length=10, choices=RatingCategory.choices)
    value = models.IntegerField(default=1200)
    games_played = models.IntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    # for Glicko (later)
    deviation = models.FloatField(null=True, blank=True)
    volatility = models.FloatField(null=True, blank=True)

    class Meta:
        unique_together = ("user", "category")
        indexes = [
            models.Index(fields=["category", "value"]),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.category}: {self.value}"
