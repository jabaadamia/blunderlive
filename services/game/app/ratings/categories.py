"""Map live game time controls to rating categories.

The current heuristic is intentionally simple.
"""


def rating_category_for_time_control(
    *,
    initial_time_ms: int,
    increment_ms: int,
) -> str:
    estimated_game_ms = initial_time_ms + (40 * increment_ms)
    if estimated_game_ms < 180_000:
        return "bullet"
    if estimated_game_ms < 600_000:
        return "blitz"
    return "rapid"
