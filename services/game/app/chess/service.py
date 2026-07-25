from uuid import uuid4
from datetime import datetime, UTC

import chess
import chess.pgn

from ..core.client import PlayerProfile, unknown_player_profile
from ..domain.exceptions import GameAlreadyFinishedError, IllegalMoveError, NotPlayersTurnError
from ..domain.models import GameSnapshot, GameParticipant
from ..domain.enums import GameResult, GameStatus, PlayerColor, TerminationType


class ChessGameService:
    def create_game(
        self,
        *,
        white_player_id,
        black_player_id,
        white_profile: PlayerProfile | None = None,
        black_profile: PlayerProfile | None = None,
        rated: bool = True,
        rating_category: str | None = None,
        initial_time_ms: int = 0,
        increment_ms: int = 0,
    ) -> GameSnapshot:
        game_id = uuid4()

        board = chess.Board()
        resolved_white = white_profile or unknown_player_profile(user_id=white_player_id)
        resolved_black = black_profile or unknown_player_profile(user_id=black_player_id)

        now = datetime.now(UTC)
        return GameSnapshot(
            game_id=game_id,
            status=GameStatus.ACTIVE,
            fen=board.fen(),
            created_at=now,
            last_move_at=None,
            white=GameParticipant(
                user_id=white_player_id, color=PlayerColor.WHITE,
                username=resolved_white.username, rating=resolved_white.rating,
            ),
            black=GameParticipant(
                user_id=black_player_id, color=PlayerColor.BLACK,
                username=resolved_black.username, rating=resolved_black.rating,
            ),
            moves=[],
            move_clocks_ms=[],
            move_count=0,
            rated=rated,
            rating_category=rating_category,
            initial_time_ms=initial_time_ms,
            increment_ms=increment_ms,
            white_time_left_ms=initial_time_ms,
            black_time_left_ms=initial_time_ms,
            turn_started_at=now,
        )

    def _side_to_move_is_white(self, snapshot: GameSnapshot) -> bool:
        return chess.Board(snapshot.fen).turn == chess.WHITE

    def remaining_time_for_turn(self, *, snapshot: GameSnapshot) -> int:
        if snapshot.initial_time_ms == 0 or snapshot.turn_started_at is None:
            return 0

        is_white_turn = self._side_to_move_is_white(snapshot)
        remaining_ms = (
            snapshot.white_time_left_ms if is_white_turn else snapshot.black_time_left_ms
        )
        elapsed_ms = int(
            (datetime.now(UTC) - snapshot.turn_started_at).total_seconds() * 1000
        )
        return max(remaining_ms - elapsed_ms, 0)

    def apply_timeout(self, *, snapshot: GameSnapshot) -> GameSnapshot | None:
        """Returns a finished snapshot if the side to move has flagged, else None."""
        if (
            snapshot.status != GameStatus.ACTIVE
            or snapshot.turn_started_at is None
            or snapshot.initial_time_ms == 0
        ):
            return None

        is_white_turn = self._side_to_move_is_white(snapshot)
        remaining_ms = (
            snapshot.white_time_left_ms if is_white_turn else snapshot.black_time_left_ms
        )
        now = datetime.now(UTC)
        elapsed_ms = int((now - snapshot.turn_started_at).total_seconds() * 1000)

        if elapsed_ms < remaining_ms:
            return None

        result = GameResult.BLACK_WIN if is_white_turn else GameResult.WHITE_WIN
        time_field = "white_time_left_ms" if is_white_turn else "black_time_left_ms"

        return snapshot.model_copy(update={
            "status": GameStatus.FINISHED,
            "result": result,
            "termination": TerminationType.TIMEOUT,
            time_field: 0,
            "last_move_at": now,
        })

    def apply_move(
        self,
        *,
        snapshot: GameSnapshot,
        player_id,
        uci_move: str,
    ) -> GameSnapshot:

        if snapshot.status != GameStatus.ACTIVE:
            raise GameAlreadyFinishedError("game_not_active")

        timed_out_snapshot = self.apply_timeout(snapshot=snapshot)
        if timed_out_snapshot is not None:
            return timed_out_snapshot

        board = chess.Board(snapshot.fen)
        is_white_turn = board.turn == chess.WHITE

        expected_player = (
            snapshot.white.user_id if is_white_turn else snapshot.black.user_id
        )
        if player_id != expected_player:
            raise NotPlayersTurnError("not_your_turn")

        try:
            move = chess.Move.from_uci(uci_move)
        except Exception:
            raise IllegalMoveError("invalid_uci")

        if move not in board.legal_moves:
            raise IllegalMoveError("illegal_move")

        board.push(move)

        new_moves = snapshot.moves + [uci_move]
        new_move_clocks_ms = list(snapshot.move_clocks_ms)
        now = datetime.now(UTC)

        time_updates: dict = {"turn_started_at": now}
        if snapshot.initial_time_ms > 0 and snapshot.turn_started_at is not None:
            elapsed_ms = int((now - snapshot.turn_started_at).total_seconds() * 1000)
            mover_time_left = (
                snapshot.white_time_left_ms if is_white_turn else snapshot.black_time_left_ms
            )
            updated_mover_time_left = (
                max(mover_time_left - elapsed_ms, 0) + snapshot.increment_ms
            )
            time_updates[
                "white_time_left_ms" if is_white_turn else "black_time_left_ms"
            ] = updated_mover_time_left
            new_move_clocks_ms.append(updated_mover_time_left)
        else:
            new_move_clocks_ms.append(0)

        status = GameStatus.ACTIVE
        result = None
        termination = None

        if board.is_checkmate():
            status = GameStatus.FINISHED
            termination = TerminationType.CHECKMATE
            result = (
                GameResult.WHITE_WIN if board.turn == chess.BLACK else GameResult.BLACK_WIN
            )
        elif board.is_stalemate():
            status = GameStatus.FINISHED
            termination = TerminationType.STALEMATE
            result = GameResult.DRAW
        elif board.is_insufficient_material():
            status = GameStatus.FINISHED
            termination = TerminationType.INSUFFICIENT_MATERIAL
            result = GameResult.DRAW
        elif board.can_claim_fifty_moves():
            status = GameStatus.FINISHED
            termination = TerminationType.FIFTY_MOVE_RULE
            result = GameResult.DRAW
        elif self._is_threefold_repetition(new_moves):
            status = GameStatus.FINISHED
            termination = TerminationType.THREEFOLD_REPETITION
            result = GameResult.DRAW

        return snapshot.model_copy(update={
            "fen": board.fen(),
            "moves": new_moves,
            "move_clocks_ms": new_move_clocks_ms,
            "move_count": len(new_moves),
            "status": status,
            "result": result,
            "termination": termination,
            "last_move_at": now,
            **time_updates,
        })

    def _is_threefold_repetition(self, moves: list[str]) -> bool:
        board = chess.Board()
        for uci_move in moves:
            board.push_uci(uci_move)
        return board.can_claim_threefold_repetition()

    def build_pgn(self, *, snapshot: GameSnapshot) -> str:
        game = chess.pgn.Game()
        game.headers["Event"] = "BlunderLive game"
        game.headers["Site"] = "BlunderLive"
        game.headers["White"] = str(snapshot.white.user_id)
        game.headers["Black"] = str(snapshot.black.user_id)
        game.headers["Result"] = snapshot.result or "*"
        game.headers["TimeControl"] = (
            f"{snapshot.initial_time_ms // 1000}+{snapshot.increment_ms // 1000}"
        )

        node = game
        for index, uci_move in enumerate(snapshot.moves):
            node = node.add_variation(chess.Move.from_uci(uci_move))
            if (
                snapshot.initial_time_ms > 0
                and index < len(snapshot.move_clocks_ms)
            ):
                clock_ms = snapshot.move_clocks_ms[index]
                node.comment = f"[%clk {_format_pgn_clock(clock_ms)}]"

        return str(game)


def _format_pgn_clock(ms: int) -> str:
    total_seconds = max(0, ms) // 1000
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours}:{minutes:02d}:{seconds:02d}"

