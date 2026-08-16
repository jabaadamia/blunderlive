import Link from "next/link";

type AuthShellProps = {
  title: string;
  description?: string;
  footerText: string;
  footerLinkHref: string;
  footerLinkLabel: string;
  children: React.ReactNode;
};

export function AuthShell({
  title,
  description,
  footerText,
  footerLinkHref,
  footerLinkLabel,
  children,
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-canvas px-4 py-10 text-ink-strong">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <section className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-line bg-surface shadow-sm md:grid-cols-[1.1fr_0.9fr]">
          <div className="border-b border-line p-8 md:border-b-0 md:border-r">
            <div className="max-w-md">
              <p className="text-sm font-medium uppercase tracking-[0.08em] text-ink-muted">
                BlunderLive
              </p>
              <h1 className="mt-4 text-3xl font-semibold">{title}</h1>
              {description ? (
                <p className="mt-3 text-sm leading-6 text-ink-secondary">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          <div className="p-8">
            {children}
            <p className="mt-6 text-sm text-ink-secondary">
              {footerText}{" "}
              <Link className="font-medium underline underline-offset-4" href={footerLinkHref}>
                {footerLinkLabel}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
