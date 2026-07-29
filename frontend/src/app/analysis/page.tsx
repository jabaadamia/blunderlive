import { AuthGuard } from "@/features/auth/components/auth-guard";
import { AnalysisBoard } from "@/features/analysis/components/analysis-board";

export default function AnalysisPage() {
  return (
    <AuthGuard>
      <AnalysisBoard />
    </AuthGuard>
  );
}
