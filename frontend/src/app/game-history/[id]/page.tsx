import { AuthGuard } from "@/features/auth/components/auth-guard";
import { HistoryBoard } from "@/features/game/components/history-board";

interface HistoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function HistoryPage({ params }: HistoryPageProps) {
  const { id } = await params;

  return (
    <AuthGuard>
      <HistoryBoard gameId={id} />
    </AuthGuard>
  );
}
