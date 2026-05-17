import { AuthGuard } from "@/features/auth/components/auth-guard";
import { MatchmakingLobby } from "@/features/matchmaking/components/matchmaking-lobby";

export default function MatchmakingPage() {
  return (
    <AuthGuard>
      <MatchmakingLobby />
    </AuthGuard>
  );
}
