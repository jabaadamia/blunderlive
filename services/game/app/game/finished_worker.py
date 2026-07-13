from __future__ import annotations

import asyncio
import logging

from redis.asyncio import Redis

from ..chess.service import ChessGameService
from ..matchmaking.repository import MatchmakingRepository
from .events import publish_finished_game_event

logger = logging.getLogger(__name__)


async def finished_game_publisher_worker(
    *,
    repository: MatchmakingRepository,
    redis: Redis,
    chess_service: ChessGameService,
    stream: str,
) -> None:
    while True:
        try:
            await publish_pending_finished_games(
                repository=repository,
                redis=redis,
                chess_service=chess_service,
                stream=stream,
            )

        except Exception:
            logger.exception("finished_game_publisher_failed")

        await asyncio.sleep(1)


async def publish_pending_finished_games(
    *,
    repository: MatchmakingRepository,
    redis: Redis,
    chess_service: ChessGameService,
    stream: str,
) -> int:
    snapshots = await repository.fetch_pending_finished_games()

    for snapshot in snapshots:
        await publish_finished_game_event(
            redis=redis,
            stream=stream,
            snapshot=snapshot,
            chess_service=chess_service,
        )
        await repository.clear_pending_finished_game(game_id=snapshot.game_id)

    return len(snapshots)
