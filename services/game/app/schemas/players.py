from pydantic import BaseModel


class PlayerDisplaySchema(BaseModel):
    user_id: str
    username: str
    rating: int | None = None

    @classmethod
    def from_participant(cls, participant) -> "PlayerDisplaySchema":
        return cls(
            user_id=str(participant.user_id),
            username=participant.username,
            rating=participant.rating,
        )
