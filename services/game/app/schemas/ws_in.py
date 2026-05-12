from typing import Annotated, Literal

from pydantic import BaseModel, Field


class MoveMessage(BaseModel):
    type: Literal["move"]
    uci: str = Field(..., min_length=4, max_length=5)

class ResignMessage(BaseModel):
    type: Literal["resign"]

class DrawOfferMessage(BaseModel):
    type: Literal["draw_offer"]

class PingMessage(BaseModel):
    type: Literal["ping"]


InboundWebSocketMessage = Annotated[
    MoveMessage
    | ResignMessage
    | DrawOfferMessage
    | PingMessage,
    Field(discriminator="type"),
]
