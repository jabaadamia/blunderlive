import asyncio
import os

import pytest
from redis.asyncio import Redis

from app.leases import acquire_lease, release_lease, renew_lease_loop


@pytest.mark.asyncio
async def test_acquire_is_exclusive_per_owner() -> None:
    redis = Redis.from_url(os.environ["REDIS_URL"], encoding="utf-8", decode_responses=True)
    await redis.flushdb()

    acquired = await acquire_lease(redis=redis, key="test:lease", owner="a", ttl_ms=5000)
    blocked = await acquire_lease(redis=redis, key="test:lease", owner="b", ttl_ms=5000)

    assert acquired is True
    assert blocked is False

    await redis.aclose()


@pytest.mark.asyncio
async def test_release_only_removes_owned_lease() -> None:
    redis = Redis.from_url(os.environ["REDIS_URL"], encoding="utf-8", decode_responses=True)
    await redis.flushdb()

    await acquire_lease(redis=redis, key="test:lease", owner="a", ttl_ms=5000)
    await release_lease(redis=redis, key="test:lease", owner="b")
    assert await redis.exists("test:lease") == 1

    await release_lease(redis=redis, key="test:lease", owner="a")
    assert await redis.exists("test:lease") == 0

    reacquired = await acquire_lease(redis=redis, key="test:lease", owner="a", ttl_ms=5000)
    assert reacquired is True

    await redis.aclose()


@pytest.mark.asyncio
async def test_renew_loop_extends_leased_ttl() -> None:
    redis = Redis.from_url(os.environ["REDIS_URL"], encoding="utf-8", decode_responses=True)
    await redis.flushdb()

    await acquire_lease(redis=redis, key="test:lease", owner="a", ttl_ms=300)
    renewal = asyncio.create_task(
        renew_lease_loop(
            redis=redis,
            key="test:lease",
            owner="a",
            ttl_ms=300,
            interval_ms=100,
        )
    )

    await asyncio.sleep(0.5)
    assert (await redis.pttl("test:lease")) > 0

    renewal.cancel()
    try:
        await renewal
    except asyncio.CancelledError:
        pass

    await redis.aclose()


@pytest.mark.asyncio
async def test_renew_loop_stops_when_lease_lost() -> None:
    redis = Redis.from_url(os.environ["REDIS_URL"], encoding="utf-8", decode_responses=True)
    await redis.flushdb()

    await acquire_lease(redis=redis, key="test:lease", owner="a", ttl_ms=5000)
    renewal = asyncio.create_task(
        renew_lease_loop(
            redis=redis,
            key="test:lease",
            owner="a",
            ttl_ms=5000,
            interval_ms=100,
        )
    )

    await asyncio.sleep(0.2)
    await release_lease(redis=redis, key="test:lease", owner="a")

    await asyncio.wait_for(asyncio.shield(renewal), timeout=2)
    assert renewal.done()

    await redis.aclose()