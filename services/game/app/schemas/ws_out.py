from typing import Annotated, Literal

from pydantic import BaseModel, Field

from ..domain.enums import GameResult, GameStatus, TerminationType
from ..domain.models import GameSnapshot


class GameStateMessage(BaseModel):
    type: Literal["game_state"] = "game_state"
    state: GameSnapshot

class MoveAcceptedMessage(BaseModel):
    type: Literal["move_accepted"] = "move_accepted"
    state: GameSnapshot

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
    state: GameSnapshot

class RatingChange(BaseModel):
    before: int
    after: int
    delta: int

class RatingUpdateConfirmedMessage(BaseModel):
    type: Literal["rating_update_confirmed"] = "rating_update_confirmed"
    game_id: str
    white_player_id: str
    black_player_id: str
    rated: bool
    rating_category: str | None = None
    white_rating_change: RatingChange | None = None
    black_rating_change: RatingChange | None = None

class ErrorMessage(BaseModel):
    type: Literal["error"] = "error"
    code: str
    detail: str | None = None

class PongMessage(BaseModel):
    type: Literal["pong"] = "pong"

    
OutboundWebSocketMessage = Annotated[
    GameStateMessage
    | MoveAcceptedMessage
    | MoveRejectedMessage
    | DrawDeclinedMessage
    | DrawOfferedMessage
    | GameOverMessage
    | RatingUpdateConfirmedMessage
    | ErrorMessage
    | PongMessage,
    Field(discriminator="type"),
]
