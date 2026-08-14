from __future__ import annotations

import asyncio
import logging

from redis.asyncio import Redis

logger = logging.getLogger(__name__)


async def acquire_lease(
    *,
    redis: Redis,
    key: str,
    owner: str,
    ttl_ms: int,
) -> bool:
    return bool(await redis.set(key, owner, nx=True, px=ttl_ms))


async def release_lease(
    *,
    redis: Redis,
    key: str,
    owner: str,
) -> None:
    await redis.eval(
        """
        if redis.call("GET", KEYS[1]) == ARGV[1] then
            return redis.call("DEL", KEYS[1])
        end
        return 0
        """,
        1,
        key,
        owner,
    )


async def renew_lease_loop(
    *,
    redis: Redis,
    key: str,
    owner: str,
    ttl_ms: int,
    interval_ms: int,
) -> None:
    while True:
        await asyncio.sleep(interval_ms / 1000)
        renewed = await redis.eval(
            """
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("PEXPIRE", KEYS[1], ARGV[2])
            end
            return 0
            """,
            1,
            key,
            owner,
            ttl_ms,
        )
        if not renewed:
            logger.warning(
                "lease_renewal_lost",
                extra={"lease": key, "owner": owner},
            )
            return
