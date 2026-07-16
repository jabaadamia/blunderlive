import { AuthGuard } from "@/features/auth/components/auth-guard";
import { ProfilePage } from "@/features/profile/components/profile-page";

interface UserProfileRouteProps {
  params: Promise<{ userId: string }>;
}

export default async function UserProfileRoute({ params }: UserProfileRouteProps) {
  const { userId } = await params;

  return (
    <AuthGuard>
      <ProfilePage userId={userId} />
    </AuthGuard>
  );
}
