from __future__ import annotations

from uuid import UUID

from ..domain.enums import GameResult, GameStatus, TerminationType

from ..chess.service import ChessGameService
from ..domain.exceptions import (
    ConcurrentMoveConflictError,
    GameAlreadyFinishedError,
    GameNotFoundError,
    InvalidDrawStateError,
    PlayerNotInGameError,
)
from ..domain.models import GameSnapshot
from .events import build_finished_game_event
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

    async def check_timeout(
        self,
        *,
        game_id: UUID,
        expected_version: int,
    ) -> GameSnapshot | None:
        try:
            snapshot = await self.repository.fetch_game_snapshot(game_id=game_id)
        except GameNotFoundError:
            return None

        if (
            snapshot.version != expected_version
            or snapshot.status != GameStatus.ACTIVE
        ):
            return None

        timed_out_snapshot = self.chess_service.apply_timeout(snapshot=snapshot)
        if timed_out_snapshot is None:
            return None

        updated_snapshot = timed_out_snapshot.model_copy(
            update={
                "version": snapshot.version + 1,
            }
        )

        saved = await self.repository.save_game_snapshot(
            expected_version=snapshot.version,
            snapshot=updated_snapshot,
            finished_game_event=self._finished_game_event(updated_snapshot),
        )
        if not saved:
            return None

        return updated_snapshot

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

        if snapshot.status != GameStatus.ACTIVE:
            raise GameAlreadyFinishedError("game_already_finished")

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

        updated_snapshot = updated_snapshot.model_copy(
            update={
                "version": snapshot.version + 1,
                "draw_offer_by": None,
            }
        )

        saved = await self.repository.save_game_snapshot(
            expected_version=snapshot.version,
            snapshot=updated_snapshot,
            finished_game_event=self._finished_game_event(updated_snapshot),
        )

        if not saved:
            raise ConcurrentMoveConflictError("concurrent_move_conflict")

        return updated_snapshot

    async def offer_draw(
        self,
        *,
        game_id: UUID,
        player_id: UUID,
    ) -> GameSnapshot:
        snapshot = await self.repository.fetch_game_snapshot(
            game_id=game_id,
        )

        if snapshot.status != GameStatus.ACTIVE:
            raise GameAlreadyFinishedError("game_already_finished")

        if player_id not in {
            snapshot.white.user_id,
            snapshot.black.user_id,
        }:
            raise PlayerNotInGameError("player_not_in_game")

        updated_snapshot = snapshot.model_copy(
            update={
                "draw_offer_by": player_id,
                "version": snapshot.version + 1,
            }
        )

        saved = await self.repository.save_game_snapshot(
            expected_version=snapshot.version,
            snapshot=updated_snapshot,
            finished_game_event=self._finished_game_event(updated_snapshot),
        )

        if not saved:
            raise ConcurrentMoveConflictError("concurrent_state_conflict")

        return updated_snapshot
    
    async def accept_draw(
        self,
        *,
        game_id: UUID,
        player_id: UUID,
    ) -> GameSnapshot:
        snapshot = await self.repository.fetch_game_snapshot(
            game_id=game_id,
        )

        if snapshot.status != GameStatus.ACTIVE:
            raise GameAlreadyFinishedError("game_already_finished")

        if snapshot.draw_offer_by is None:
            raise InvalidDrawStateError("no_draw_offer")

        if snapshot.draw_offer_by == player_id:
            raise InvalidDrawStateError("cannot_accept_own_draw")

        updated_snapshot = snapshot.model_copy(
            update={
                "status": GameStatus.FINISHED,
                "result": GameResult.DRAW,
                "termination": TerminationType.DRAW_AGREEMENT,
                "draw_offer_by": None,
                "version": snapshot.version + 1,
            }
        )

        saved = await self.repository.save_game_snapshot(
            expected_version=snapshot.version,
            snapshot=updated_snapshot,
            finished_game_event=self._finished_game_event(updated_snapshot),
        )

        if not saved:
            raise ConcurrentMoveConflictError("concurrent_state_conflict")

        return updated_snapshot

    async def decline_draw(
        self,
        *,
        game_id: UUID,
        player_id: UUID,
    ) -> GameSnapshot:
        snapshot = await self.repository.fetch_game_snapshot(
            game_id=game_id,
        )

        if snapshot.status != GameStatus.ACTIVE:
            raise GameAlreadyFinishedError("game_already_finished")

        if snapshot.draw_offer_by is None:
            raise InvalidDrawStateError("no_draw_offer")

        if snapshot.draw_offer_by == player_id:
            raise InvalidDrawStateError("cannot_decline_own_draw")

        updated_snapshot = snapshot.model_copy(
            update={
                "draw_offer_by": None,
                "version": snapshot.version + 1,
            }
        )

        saved = await self.repository.save_game_snapshot(
            expected_version=snapshot.version,
            snapshot=updated_snapshot,
            finished_game_event=self._finished_game_event(updated_snapshot),
        )

        if not saved:
            raise ConcurrentMoveConflictError("concurrent_state_conflict")

        return updated_snapshot

    async def resign_game(
        self,
        *,
        game_id: UUID,
        player_id: UUID,
    ) -> GameSnapshot:
        snapshot = await self.repository.fetch_game_snapshot(
            game_id=game_id,
        )

        if snapshot.status != GameStatus.ACTIVE:
            raise GameAlreadyFinishedError("game_already_finished")

        if player_id == snapshot.white.user_id:
            result = GameResult.BLACK_WIN
        elif player_id == snapshot.black.user_id:
            result = GameResult.WHITE_WIN
        else:
            raise PlayerNotInGameError("player_not_in_game")

        updated_snapshot = snapshot.model_copy(
            update={
                "status": GameStatus.FINISHED,
                "result": result,
                "termination": TerminationType.RESIGNATION,
                "draw_offer_by": None,
                "version": snapshot.version + 1,
            }
        )

        saved = await self.repository.save_game_snapshot(
            expected_version=snapshot.version,
            snapshot=updated_snapshot,
            finished_game_event=self._finished_game_event(updated_snapshot),
        )

        if not saved:
            raise ConcurrentMoveConflictError("concurrent_state_conflict")

        return updated_snapshot

    def _finished_game_event(self, snapshot: GameSnapshot) -> dict[str, str] | None:
        if snapshot.status != GameStatus.FINISHED:
            return None

        return build_finished_game_event(
            snapshot=snapshot,
            chess_service=self.chess_service,
        )
