from ..chess.service import ChessGameService
from .repository import MatchmakingRepository


class MatchmakingService:
    def __init__(
        self,
        repository: MatchmakingRepository,
        chess_service: ChessGameService,
    ) -> None:
        self.repository = repository
        self.chess_service = chess_service

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

            snapshot = self.chess_service.create_game(
                white_player_id=player_one_id,
                black_player_id=player_two_id,
            )

            success = await self.repository.try_create_match(
                queue_bucket=bucket,
                player_one_id=player_one_id,
                player_two_id=player_two_id,
                snapshot=snapshot,
            )

            if not success:
                continue

            # TODO:
            # - publish websocket event