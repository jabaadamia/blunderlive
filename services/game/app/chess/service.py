from uuid import uuid4
from datetime import datetime, UTC

import chess

from ..domain.exceptions import GameAlreadyFinishedError, IllegalMoveError, NotPlayersTurnError

from ..domain.models import GameSnapshot, GameParticipant
from ..domain.enums import GameResult, GameStatus, PlayerColor, TerminationType, TerminationType


class ChessGameService:
    def create_game(
        self,
        *,
        white_player_id,
        black_player_id,
    ) -> GameSnapshot:
        game_id = uuid4()

        board = chess.Board()

        snapshot = GameSnapshot(
            game_id=game_id,
            status=GameStatus.ACTIVE,
            fen=board.fen(),
            created_at=datetime.now(UTC),
            last_move_at=None,
            white=GameParticipant(
                user_id=white_player_id,
                color=PlayerColor.WHITE,
            ),
            black=GameParticipant(
                user_id=black_player_id,
                color=PlayerColor.BLACK,
            ),
            moves=[],
            move_count=0,
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
    
    