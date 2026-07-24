from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from ..domain.enums import GameStatus
from ..schemas.ws_out import GameOverMessage
from .connection_manager import ConnectionManager
from .service import GameSessionService

logger = logging.getLogger(__name__)


class ClockWatchdogManager:
    """Tracks one timeout-check task per active game.

    Single-process only: relies on in-memory asyncio tasks, same assumption
    ConnectionManager already makes. If game-service ever runs multiple
    instances, this needs to move to a shared mechanism (e.g. Redis key
    expiry notifications) instead.
    """

    def __init__(
        self,
        session_service: GameSessionService,
        manager: ConnectionManager,
    ) -> None:
        self.session_service = session_service
        self.manager = manager
        self._tasks: dict[UUID, asyncio.Task] = {}

    def schedule(self, *, game_id: UUID, version: int, delay_ms: int) -> None:
        self.cancel(game_id=game_id)
        self._tasks[game_id] = asyncio.create_task(
            self._watch(game_id=game_id, version=version, delay_ms=delay_ms)
        )

    def cancel(self, *, game_id: UUID) -> None:
        task = self._tasks.pop(game_id, None)
        if task and not task.done():
            task.cancel()

    def cancel_all(self) -> None:
        for game_id, task in list(self._tasks.items()):
            if not task.done():
                task.cancel()
        self._tasks.clear()

    async def _watch(self, *, game_id: UUID, version: int, delay_ms: int) -> None:
        try:
            await asyncio.sleep(max(delay_ms, 0) / 1000)
            snapshot = await self.session_service.check_timeout(
                game_id=game_id,
                expected_version=version,
            )
            if snapshot is not None and snapshot.status == GameStatus.FINISHED:
                await self.manager.broadcast(
                    game_id=game_id,
                    message=GameOverMessage(state=snapshot),
                )
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception(
                "clock_watchdog_failed",
                extra={"game_id": str(game_id)},
            )
        finally:
            current_task = self._tasks.get(game_id)
            if current_task is asyncio.current_task():
                self._tasks.pop(game_id, None)
