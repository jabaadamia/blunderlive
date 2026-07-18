"use client";

import Link from "next/link";

export type LivePlayerDisplay = {
  userId: string;
  username: string | null;
  rating: number | null;
};

type PlayerLabelProps = {
  player: LivePlayerDisplay | null;
  showRating?: boolean;
};

export function PlayerLabel({ player, showRating = true }: PlayerLabelProps) {
  if (!player) {
    return <div className="h-6" />;
  }

  return (
    <div className="flex items-center gap-2 font-medium">
      <Link
        href={`/profile/${player.userId}`}
        className="text-neutral-900 hover:underline dark:text-neutral-100"
      >
        {player.username ?? "Unknown player"}
      </Link>
      {showRating && player.rating !== null && (
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {player.rating}
        </span>
      )}
    </div>
  );
}
