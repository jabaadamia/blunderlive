from pydantic import BaseModel, Field


class TimeControlSchema(BaseModel):
    initial_time_ms: int = Field(..., gt=0)
    increment_ms: int = Field(default=0, ge=0)
