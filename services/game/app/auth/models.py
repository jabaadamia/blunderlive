from uuid import UUID

from pydantic import BaseModel


class PlayerIdentity(BaseModel):
    user_id: UUID
    token_id: str | None = None
