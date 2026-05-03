from django.urls import path

from ratings.api.views import MyRatingHistoryView, MyRatingsView, UserRatingsView


urlpatterns = [
    path("me/", MyRatingsView.as_view(), name="ratings-me"),
    path("me/history/", MyRatingHistoryView.as_view(), name="ratings-me-history"),
    path("users/<uuid:user_id>/", UserRatingsView.as_view(), name="ratings-user"),
]
