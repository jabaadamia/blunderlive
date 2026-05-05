from typing import Literal, Union

from pydantic import BaseModel, Field


class MoveMessage(BaseModel):
    type: Literal["move"]
    uci: str = Field(..., min_length=4, max_length=5)


class ResignMessage(BaseModel):
    type: Literal["resign"]


class PingMessage(BaseModel):
    type: Literal["ping"]


InboundWebSocketMessage = Union[MoveMessage, ResignMessage, PingMessage]
