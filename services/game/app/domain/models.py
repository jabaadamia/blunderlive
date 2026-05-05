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
    white: GameParticipant
    black: GameParticipant
    result: GameResult | None = None
    termination: TerminationType | None = None
    move_count: int = Field(default=0, ge=0)
