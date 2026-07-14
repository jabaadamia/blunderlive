from drf_spectacular.utils import OpenApiParameter, extend_schema
from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from ratings.api.serializers import RatingHistorySerializer, RatingSerializer
from ratings.models import RatingCategory
from ratings.services import (
    get_rating_history_for_user,
    get_ratings_for_user,
)
from users.models import User


class MyRatingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(tags=["ratings"], responses=RatingSerializer(many=True))
    def get(self, request):
        ratings = get_ratings_for_user(request.user)
        serializer = RatingSerializer(ratings, many=True)
        return Response(serializer.data)


class UserRatingsView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(tags=["ratings"], responses=RatingSerializer(many=True))
    def get(self, request, user_id):
        user = get_object_or_404(User, pk=user_id)
        ratings = get_ratings_for_user(user)
        serializer = RatingSerializer(ratings, many=True)
        return Response(serializer.data)


class MyRatingHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["ratings"],
        parameters=[
            OpenApiParameter(
                name="category",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                enum=[choice[0] for choice in RatingCategory.choices],
            )
        ],
        responses=RatingHistorySerializer(many=True),
    )
    def get(self, request):
        category = request.query_params.get("category")
        history = get_rating_history_for_user(request.user, category=category)
        serializer = RatingHistorySerializer(history, many=True)
        return Response(serializer.data)

class UserRatingHistoryView(APIView):
    permission_classes = [permissions.AllowAny]
    @extend_schema(
        tags=["ratings"],
        parameters=[
            OpenApiParameter(
                name="category",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                enum=[choice[0] for choice in RatingCategory.choices],
            )
        ],
        responses=RatingHistorySerializer(many=True),
    )
    def get(self, request, user_id):
        user = get_object_or_404(User, pk=user_id)
        category = request.query_params.get("category")
        history = get_rating_history_for_user(user, category=category)
        serializer = RatingHistorySerializer(history, many=True)
        return Response(serializer.data)
