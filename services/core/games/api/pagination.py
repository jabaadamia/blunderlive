from rest_framework.pagination import CursorPagination


class GameCursorPagination(CursorPagination):
    page_size = 20
    ordering = "-started_at"
    cursor_query_param = "cursor"
