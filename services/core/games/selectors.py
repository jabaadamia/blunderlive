from django.db.models import Q, QuerySet

from .models import Game


def get_games_for_user(user, category: str | None = None) -> QuerySet[Game]:
    qs = Game.objects.filter(
        Q(white_player=user) | Q(black_player=user)
    ).select_related("white_player", "black_player")
    if category:
        qs = qs.filter(rating_category=category)
    return qs
