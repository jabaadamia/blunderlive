import { AuthPageGuard } from "@/features/auth/components/auth-page-guard";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <AuthPageGuard>
      <AuthShell
        title="Sign in"
        footerText="Need an account?"
        footerLinkHref="/register"
        footerLinkLabel="Create one"
      >
        <LoginForm />
      </AuthShell>
    </AuthPageGuard>
  );
}
