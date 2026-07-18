from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth.dependencies import get_current_player_http
from ..auth.models import PlayerIdentity
from ..dependencies import get_matchmaking_repository
from .repository import (
    DuplicateQueueEntryError,
    MatchmakingRepository,
    PlayerInActiveGameError,
)
from ..schemas.matchmaking import (
    MatchmakingJoinResponseSchema,
    MatchmakingRequestSchema,
    MatchmakingStatusResponse,
)
from ..schemas.players import PlayerDisplaySchema

router = APIRouter(prefix="/matchmaking", tags=["matchmaking"])


@router.post("/join", response_model=MatchmakingJoinResponseSchema, status_code=status.HTTP_200_OK)
async def join_matchmaking_queue(
    payload: MatchmakingRequestSchema,
    player: PlayerIdentity = Depends(get_current_player_http),
    repository: MatchmakingRepository = Depends(get_matchmaking_repository),
) -> MatchmakingJoinResponseSchema:
    try:
        queue_bucket = await repository.enqueue_player(
            user_id=player.user_id,
            rated=payload.rated,
            initial_time_ms=payload.time_control.initial_time_ms,
            increment_ms=payload.time_control.increment_ms,
        )
    except DuplicateQueueEntryError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except PlayerInActiveGameError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return MatchmakingJoinResponseSchema(
        status="queued",
        queue=queue_bucket,
        rated=payload.rated,
        time_control=payload.time_control,
    )

@router.post("/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_matchmaking_queue(
    player: PlayerIdentity = Depends(get_current_player_http),
    repository: MatchmakingRepository = Depends(get_matchmaking_repository),
) -> None:
    await repository.remove_player(user_id=player.user_id)


@router.get("/status", response_model=MatchmakingStatusResponse, status_code=status.HTTP_200_OK)
async def matchmaking_status(
    player: PlayerIdentity = Depends(get_current_player_http),
    repository: MatchmakingRepository = Depends(get_matchmaking_repository),
) -> MatchmakingStatusResponse:
    status = await repository.fetch_queue_status(user_id=player.user_id)

    if status.active_game_id:
        snapshot = await repository.fetch_game_snapshot(
            game_id=UUID(status.active_game_id),
        )
        return MatchmakingStatusResponse(
            state="matched",
            active_game_id=status.active_game_id,
            white_player=PlayerDisplaySchema.from_participant(snapshot.white),
            black_player=PlayerDisplaySchema.from_participant(snapshot.black),
        )

    if status.is_queued:
        return MatchmakingStatusResponse(
            state="queued",
            queue=status.queue,
            rated=status.rated,
            initial_time_ms=status.initial_time_ms,
            increment_ms=status.increment_ms,
            joined_at=status.joined_at,
        )

    return MatchmakingStatusResponse(state="idle")