from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from .enums import GameResult, GameStatus, PlayerColor, TerminationType


class GameParticipant(BaseModel):
    user_id: UUID
    color: PlayerColor


class GameSnapshot(BaseModel):
    game_id: UUID
    status: GameStatus
    fen: str
    created_at: datetime
    last_move_at: datetime | None = None
    white: GameParticipant
    black: GameParticipant
    moves: list[str] = Field(default_factory=list)
    result: GameResult | None = None
    termination: TerminationType | None = None
    move_count: int = Field(default=0, ge=0)
    rated: bool = True
    rating_category: str | None = None
    initial_time_ms: int = Field(default=0, ge=0)
    increment_ms: int = Field(default=0, ge=0)
    draw_offer_by: UUID | None = None
    version: int = Field(default=0, ge=0)
