from uuid import uuid4

from .repository import MatchmakingRepository


class MatchmakingService:
    def __init__(self, repository: MatchmakingRepository) -> None:
        self.repository = repository

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

            game_id = str(uuid4())

            success = await self.repository.try_create_match(
                queue_bucket=bucket,
                player_one_id=player_one_id,
                player_two_id=player_two_id,
                game_id=game_id,
            )

            if not success:
                continue

            # TODO:
            # - create persistent DB game
            # - initialize chess state
            # - publish websocket event
            # - store game snapshot