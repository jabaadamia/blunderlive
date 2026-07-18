import pytest

from app.ratings.categories import rating_category_for_time_control


@pytest.mark.parametrize(
    ("initial_time_ms", "increment_ms", "expected"),
    [
        (60_000, 0, "bullet"),
        (180_000, 0, "blitz"),
        (300_000, 0, "blitz"),
        (600_000, 0, "rapid"),
        (500_000, 3_000, "rapid"),
    ],
)
def test_rating_category_for_time_control(
    initial_time_ms: int,
    increment_ms: int,
    expected: str,
) -> None:
    assert (
        rating_category_for_time_control(
            initial_time_ms=initial_time_ms,
            increment_ms=increment_ms,
        )
        == expected
    )
