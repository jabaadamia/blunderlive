from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from pydantic import TypeAdapter, ValidationError
from redis.asyncio import Redis

from ..schemas.ws_out import OutboundWebSocketMessage
from .connection_manager import ConnectionManager

logger = logging.getLogger(__name__)

outbound_adapter = TypeAdapter(OutboundWebSocketMessage)


def game_event_channel(game_id: UUID | str) -> str:
    return f"game:events:{game_id}"


async def publish_game_event(
    *,
    redis: Redis,
    game_id: UUID,
    message: OutboundWebSocketMessage,
) -> int:
    return await redis.publish(
        game_event_channel(game_id),
        message.model_dump_json(),
    )


async def relay_game_events(
    *,
    redis: Redis,
    manager: ConnectionManager,
) -> None:
    while True:
        pubsub = redis.pubsub()
        try:
            await pubsub.psubscribe("game:events:*")
            async for message in pubsub.listen():
                if message["type"] != "pmessage":
                    continue

                channel = message["channel"]
                if isinstance(channel, bytes):
                    channel = channel.decode()

                try:
                    game_id = UUID(channel.removeprefix("game:events:"))
                    outbound = outbound_adapter.validate_json(message["data"])
                except (ValueError, ValidationError):
                    logger.exception(
                        "invalid_game_pubsub_message",
                        extra={"channel": channel},
                    )
                    continue

                await manager.broadcast_local(
                    game_id=game_id,
                    message=outbound,
                )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("game_pubsub_relay_failed")
            await asyncio.sleep(1)
        finally:
            await pubsub.aclose()
