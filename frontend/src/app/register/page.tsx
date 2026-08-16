import { AuthPageGuard } from "@/features/auth/components/auth-page-guard";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { RegisterForm } from "@/features/auth/components/register-form";

export default function RegisterPage() {
  return (
    <AuthPageGuard>
      <AuthShell
        title="Create account"
        footerText="Already registered?"
        footerLinkHref="/login"
        footerLinkLabel="Sign in"
      >
        <RegisterForm />
      </AuthShell>
    </AuthPageGuard>
  );
}
