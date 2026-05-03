import { AuthGuard } from "@/features/auth/components/auth-guard";
import { RatingsDashboard } from "@/features/ratings/components/ratings-dashboard";

export default function HomePage() {
  return (
    <AuthGuard>
      <RatingsDashboard />
    </AuthGuard>
  );
}
