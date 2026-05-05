from typing import Literal, Union

from pydantic import BaseModel

from ..domain.enums import GameResult, GameStatus, TerminationType
from ..domain.models import GameSnapshot


class GameStateMessage(BaseModel):
    type: Literal["game_state"] = "game_state"
    state: GameSnapshot


class MoveAcceptedMessage(BaseModel):
    type: Literal["move_accepted"] = "move_accepted"
    uci: str
    fen: str
    status: GameStatus


class MoveRejectedMessage(BaseModel):
    type: Literal["move_rejected"] = "move_rejected"
    reason: str

class DrawDeclinedMessage(BaseModel):
    type: Literal["draw_declined"] = "draw_declined"
    reason: str

class DrawOfferedMessage(BaseModel):
    type: Literal["draw_offered"] = "draw_offered"

class GameOverMessage(BaseModel):
    type: Literal["game_over"] = "game_over"
    result: GameResult
    termination: TerminationType


class ErrorMessage(BaseModel):
    type: Literal["error"] = "error"
    code: str
    detail: str | None = None


OutboundWebSocketMessage = Union[
    GameStateMessage,
    MoveAcceptedMessage,
    MoveRejectedMessage,
    DrawDeclinedMessage,
    DrawOfferedMessage,
    GameOverMessage,
    ErrorMessage,
]
