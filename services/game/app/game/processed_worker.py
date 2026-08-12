from __future__ import annotations

import asyncio
import logging
import socket
from uuid import UUID

from redis.asyncio import Redis
from redis.exceptions import ResponseError

from ..schemas.ws_out import RatingUpdateConfirmedMessage
from .events import parse_processed_game_event
from .pubsub import publish_game_event

logger = logging.getLogger(__name__)


async def processed_game_worker(
    *,
    redis: Redis,
    stream: str,
    group: str,
    consumer: str | None = None,
) -> None:
    consumer_name = consumer or socket.gethostname()
    await _ensure_group(redis=redis, stream=stream, group=group)

    while True:
        try:
            await _process_pending(
                redis=redis,
                stream=stream,
                group=group,
                consumer=consumer_name,
            )
            entries = await redis.xreadgroup(
                groupname=group,
                consumername=consumer_name,
                streams={stream: ">"},
                count=20,
                block=5000,
            )

            for _, messages in entries:
                for entry_id, fields in messages:
                    await _broadcast_processed_event(
                        redis=redis,
                        stream=stream,
                        group=group,
                        entry_id=entry_id,
                        fields=fields,
                    )

        except Exception:
            logger.exception("processed_game_worker_failed")
            await asyncio.sleep(1)


async def _ensure_group(*, redis: Redis, stream: str, group: str) -> None:
    try:
        await redis.xgroup_create(name=stream, groupname=group, id="0", mkstream=True)
    except ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise


async def _process_pending(
    *,
    redis: Redis,
    stream: str,
    group: str,
    consumer: str,
) -> None:
    claimed = await redis.xautoclaim(
        name=stream,
        groupname=group,
        consumername=consumer,
        min_idle_time=60_000,
        start_id="0-0",
        count=20,
    )

    messages = _claimed_messages(claimed)
    for entry_id, fields in messages:
        await _broadcast_processed_event(
            redis=redis,
            stream=stream,
            group=group,
            entry_id=entry_id,
            fields=fields,
        )


async def _broadcast_processed_event(
    *,
    redis: Redis,
    stream: str,
    group: str,
    entry_id: str,
    fields: dict[str, str],
) -> None:
    event = parse_processed_game_event(fields)
    game_id = UUID(event["game_id"])
    await publish_game_event(
        redis=redis,
        game_id=game_id,
        message=RatingUpdateConfirmedMessage(**event),
    )
    await redis.xack(stream, group, entry_id)


def _claimed_messages(claimed) -> list[tuple[str, dict[str, str]]]:
    if not claimed:
        return []

    if isinstance(claimed, tuple):
        return list(claimed[1])

    if isinstance(claimed, list):
        if len(claimed) >= 2 and isinstance(claimed[0], str):
            return list(claimed[1])

        return list(claimed)

    return []
