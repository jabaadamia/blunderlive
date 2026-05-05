from pydantic import BaseModel

from .common import TimeControlSchema


class MatchmakingRequestSchema(BaseModel):
    rated: bool = True
    time_control: TimeControlSchema
