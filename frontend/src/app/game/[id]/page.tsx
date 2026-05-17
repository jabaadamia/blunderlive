import { AuthGuard } from "@/features/auth/components/auth-guard";
import { GameBoard } from "@/features/game/components/game-board";

interface GamePageProps {
  params: Promise<{ id: string }>;
}

export default async function GamePage({ params }: GamePageProps) {
  const { id } = await params;

  return (
    <AuthGuard>
      <GameBoard gameId={id} />
    </AuthGuard>
  );
}
