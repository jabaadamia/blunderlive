from uuid import UUID

from ..chess.service import ChessGameService
from ..core.client import PlayerProfileClient
from ..ratings.categories import rating_category_for_time_control
from .repository import MatchmakingRepository, parse_time_control_bucket


class MatchmakingService:
    def __init__(
        self,
        repository: MatchmakingRepository,
        chess_service: ChessGameService,
        player_client: PlayerProfileClient,
    ) -> None:
        self.repository = repository
        self.chess_service = chess_service
        self.player_client = player_client

    async def run_matchmaking_cycle(self) -> None:
        buckets = await self.repository.fetch_active_buckets()

        for bucket in buckets:
            await self._match_bucket(bucket)

    async def _match_bucket(self, bucket: str) -> None:
        while True:
            players = await self.repository.fetch_waiting_players(
                queue_bucket=bucket,
                limit=2,
            )

            if len(players) < 2:
                return

            player_one_id = players[0]
            player_two_id = players[1]
            rated, initial_time_ms, increment_ms = parse_time_control_bucket(bucket)
            rating_category = (
                rating_category_for_time_control(
                    initial_time_ms=initial_time_ms,
                    increment_ms=increment_ms,
                )
                if rated
                else None
            )

            player_profiles = await self.player_client.fetch_game_players(
                user_ids=[UUID(player_one_id), UUID(player_two_id)],
                rating_category=rating_category,
            )

            snapshot = self.chess_service.create_game(
                white_player_id=player_one_id,
                black_player_id=player_two_id,
                white_profile=player_profiles[UUID(player_one_id)],
                black_profile=player_profiles[UUID(player_two_id)],
                rated=rated,
                rating_category=rating_category,
                initial_time_ms=initial_time_ms,
                increment_ms=increment_ms,
            )

            success = await self.repository.try_create_match(
                queue_bucket=bucket,
                player_one_id=player_one_id,
                player_two_id=player_two_id,
                snapshot=snapshot,
            )

            if not success:
                continue
