from __future__ import annotations

from uuid import UUID

from ..chess.service import ChessGameService
from ..domain.exceptions import ConcurrentMoveConflictError, PlayerNotInGameError
from ..domain.models import GameSnapshot
from ..matchmaking.repository import MatchmakingRepository


class GameSessionService:
    def __init__(
        self,
        repository: MatchmakingRepository,
        chess_service: ChessGameService,
    ) -> None:
        self.repository = repository
        self.chess_service = chess_service

    async def get_game_snapshot(self, *, game_id: UUID) -> GameSnapshot:
        return await self.repository.fetch_game_snapshot(game_id=game_id)

    async def apply_move(
        self,
        *,
        game_id: UUID,
        player_id: UUID,
        uci_move: str,
    ) -> GameSnapshot:
        snapshot = await self.repository.fetch_game_snapshot(
            game_id=game_id,
        )

        if player_id not in {
            snapshot.white.user_id,
            snapshot.black.user_id,
        }:
            raise PlayerNotInGameError("player_not_in_game")

        updated_snapshot = self.chess_service.apply_move(
            snapshot=snapshot,
            player_id=player_id,
            uci_move=uci_move,
        )

        saved = await self.repository.update_game_snapshot(
            previous_move_count=snapshot.move_count,
            snapshot=updated_snapshot,
        )

        if not saved:
            raise ConcurrentMoveConflictError(
                "concurrent_move_conflict",
            )

        return updated_snapshot