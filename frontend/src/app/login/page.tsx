import { AuthPageGuard } from "@/features/auth/components/auth-page-guard";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <AuthPageGuard>
      <AuthShell
        title="Sign in"
        description="Use your email and password to get an access token, while the refresh token stays in the httpOnly cookie managed by the backend."
        footerText="Need an account?"
        footerLinkHref="/register"
        footerLinkLabel="Create one"
      >
        <LoginForm />
      </AuthShell>
    </AuthPageGuard>
  );
}
