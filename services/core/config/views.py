from django.http import JsonResponse


def health(_: object) -> JsonResponse:
    return JsonResponse({"status": "ok", "service": "core"})
