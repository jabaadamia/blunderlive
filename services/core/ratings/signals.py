from django.db.models.signals import post_save
from django.dispatch import receiver

from ratings.services import ensure_default_ratings_for_user
from users.models import User


@receiver(post_save, sender=User)
def create_default_ratings_for_user(sender, instance, created, **kwargs):
    if not created:
        return

    ensure_default_ratings_for_user(instance)
