from datetime import datetime
from typing import Optional
from typing_extensions import Literal

from pydantic import BaseModel

from .common import TimeControlSchema
from .players import PlayerDisplaySchema


class MatchmakingRequestSchema(BaseModel):
    rated: bool = True
    time_control: TimeControlSchema


class MatchmakingJoinResponseSchema(BaseModel):
    status: str
    queue: str
    rated: bool
    time_control: TimeControlSchema

class MatchmakingStatusResponse(BaseModel):
    state: Literal["idle", "queued", "matched"]

    # present when queued
    queue: Optional[str] = None
    rated: Optional[bool] = None
    initial_time_ms: Optional[int] = None
    increment_ms: Optional[int] = None
    joined_at: Optional[datetime] = None

    # present when matched
    active_game_id: Optional[str] = None
    white_player: Optional[PlayerDisplaySchema] = None
    black_player: Optional[PlayerDisplaySchema] = None