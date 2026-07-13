from __future__ import annotations

import socket

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from redis import Redis
from redis.exceptions import ResponseError

from games.services import build_processed_game_event, process_finished_game
from games.streams import parse_finished_game_stream_entry
from users.models import User


class Command(BaseCommand):
    help = "Consume finished game events from Redis Streams and persist them in core."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--consumer",
            default=socket.gethostname(),
            help="Consumer name used within the Redis consumer group.",
        )
        parser.add_argument(
            "--block-ms",
            type=int,
            default=5000,
            help="How long to block waiting for new messages.",
        )
        parser.add_argument(
            "--count",
            type=int,
            default=10,
            help="Maximum number of messages to fetch per read.",
        )
        parser.add_argument(
            "--once",
            action="store_true",
            help="Process at most one batch and exit.",
        )
        parser.add_argument(
            "--claim-idle-ms",
            type=int,
            default=60000,
            help="Claim pending messages idle for at least this many milliseconds.",
        )

    def handle(self, *args, **options) -> None:
        redis_url = settings.CORE_REDIS_URL
        if not redis_url:
            raise CommandError("REDIS_URL must be configured to process finished games.")

        redis = Redis.from_url(redis_url, decode_responses=True)
        stream = settings.CORE_GAMES_FINISHED_STREAM
        group = settings.CORE_GAMES_CONSUMER_GROUP
        processed_stream = settings.CORE_GAMES_PROCESSED_STREAM
        failed_stream = settings.CORE_GAMES_FAILED_STREAM
        consumer = options["consumer"]

        self._ensure_group(redis=redis, stream=stream, group=group)

        while True:
            processed_count = self._process_pending_entries(
                redis=redis,
                stream=stream,
                processed_stream=processed_stream,
                failed_stream=failed_stream,
                group=group,
                consumer=consumer,
                count=options["count"],
                min_idle_time=options["claim_idle_ms"],
            )

            if processed_count and options["once"]:
                return

            entries = redis.xreadgroup(
                groupname=group,
                consumername=consumer,
                streams={stream: ">"},
                count=options["count"],
                block=options["block_ms"],
            )

            if not entries:
                if options["once"]:
                    return
                continue

            for _, messages in entries:
                for entry_id, fields in messages:
                    self._process_entry(
                        redis=redis,
                        stream=stream,
                        processed_stream=processed_stream,
                        failed_stream=failed_stream,
                        group=group,
                        entry_id=entry_id,
                        fields=fields,
                    )

            if options["once"]:
                return

    def _ensure_group(self, *, redis: Redis, stream: str, group: str) -> None:
        try:
            redis.xgroup_create(name=stream, groupname=group, id="0", mkstream=True)
        except ResponseError as exc:
            if "BUSYGROUP" not in str(exc):
                raise

    def _process_entry(
        self,
        *,
        redis: Redis,
        stream: str,
        processed_stream: str,
        failed_stream: str,
        group: str,
        entry_id: str,
        fields: dict[str, str],
    ) -> None:
        try:
            payload = parse_finished_game_stream_entry(fields)
            result = process_finished_game(payload=payload)
            redis.xadd(
                processed_stream,
                build_processed_game_event(game=result.game),
            )
            redis.xack(stream, group, entry_id)
        except (KeyError, ValueError, User.DoesNotExist) as exc:
            redis.xadd(
                failed_stream,
                {
                    "source_stream": stream,
                    "source_entry_id": entry_id,
                    "error": str(exc),
                    **{f"payload_{key}": str(value) for key, value in fields.items()},
                },
            )
            redis.xack(stream, group, entry_id)
            self.stderr.write(
                self.style.ERROR(f"Moved invalid finished game event {entry_id} to {failed_stream}.")
            )

    def _process_pending_entries(
        self,
        *,
        redis: Redis,
        stream: str,
        processed_stream: str,
        failed_stream: str,
        group: str,
        consumer: str,
        count: int,
        min_idle_time: int,
    ) -> int:
        claimed = redis.xautoclaim(
            name=stream,
            groupname=group,
            consumername=consumer,
            min_idle_time=min_idle_time,
            start_id="0-0",
            count=count,
        )
        messages = self._claimed_messages(claimed)

        for entry_id, fields in messages:
            self._process_entry(
                redis=redis,
                stream=stream,
                processed_stream=processed_stream,
                failed_stream=failed_stream,
                group=group,
                entry_id=entry_id,
                fields=fields,
            )

        return len(messages)

    @staticmethod
    def _claimed_messages(claimed) -> list[tuple[str, dict[str, str]]]:
        if not claimed:
            return []

        if isinstance(claimed, tuple):
            return list(claimed[1])

        if isinstance(claimed, list):
            if len(claimed) >= 2 and isinstance(claimed[0], str):
                return list(claimed[1])

            return list(claimed)

        return []
