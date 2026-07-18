from uuid import uuid4
from datetime import datetime, UTC

import chess
import chess.pgn

from ..core.client import PlayerProfile, unknown_player_profile
from ..domain.exceptions import GameAlreadyFinishedError, IllegalMoveError, NotPlayersTurnError

from ..domain.models import GameSnapshot, GameParticipant
from ..domain.enums import GameResult, GameStatus, PlayerColor, TerminationType, TerminationType


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
        resolved_white = white_profile or unknown_player_profile(
            user_id=white_player_id,
        )
        resolved_black = black_profile or unknown_player_profile(
            user_id=black_player_id,
        )

        snapshot = GameSnapshot(
            game_id=game_id,
            status=GameStatus.ACTIVE,
            fen=board.fen(),
            created_at=datetime.now(UTC),
            last_move_at=None,
            white=GameParticipant(
                user_id=white_player_id,
                color=PlayerColor.WHITE,
                username=resolved_white.username,
                rating=resolved_white.rating,
            ),
            black=GameParticipant(
                user_id=black_player_id,
                color=PlayerColor.BLACK,
                username=resolved_black.username,
                rating=resolved_black.rating,
            ),
            moves=[],
            move_count=0,
            rated=rated,
            rating_category=rating_category,
            initial_time_ms=initial_time_ms,
            increment_ms=increment_ms,
        )

        return snapshot
    
    def apply_move(
        self,
        *,
        snapshot: GameSnapshot,
        player_id,
        uci_move: str,
    ) -> GameSnapshot:

        if snapshot.status != GameStatus.ACTIVE:
            raise GameAlreadyFinishedError("game_not_active")

        # reconstruct board from move history
        board = chess.Board()
        for move in snapshot.moves:
            board.push_uci(move)

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

        # detect game end conditions
        status = GameStatus.ACTIVE
        result = None
        termination = None

        if board.is_checkmate():
            status = GameStatus.FINISHED
            termination = TerminationType.CHECKMATE
            result = (
                GameResult.WHITE_WIN
                if board.turn == chess.BLACK
                else GameResult.BLACK_WIN
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

        elif board.can_claim_threefold_repetition():
            status = GameStatus.FINISHED
            termination = TerminationType.THREEFOLD_REPETITION
            result = GameResult.DRAW

        return snapshot.model_copy(update={
            "fen": board.fen(),
            "moves": new_moves,
            "move_count": len(new_moves),
            "status": status,
            "result": result,
            "termination": termination,
            "last_move_at": datetime.now(UTC),
        })

    def build_pgn(self, *, snapshot: GameSnapshot) -> str:
        board = chess.Board()
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
        for uci_move in snapshot.moves:
            move = chess.Move.from_uci(uci_move)
            node = node.add_variation(move)
            board.push(move)

        return str(game)
    
    
