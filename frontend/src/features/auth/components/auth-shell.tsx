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
    <main className="min-h-screen bg-neutral-50 px-4 py-10 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <section className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 md:grid-cols-[1.1fr_0.9fr]">
          <div className="border-b border-neutral-200 p-8 md:border-b-0 md:border-r dark:border-neutral-800">
            <div className="max-w-md">
              <p className="text-sm font-medium uppercase tracking-[0.08em] text-neutral-500">
                BlunderLive
              </p>
              <h1 className="mt-4 text-3xl font-semibold">{title}</h1>
              {description ? (
                <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          <div className="p-8">
            {children}
            <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-300">
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
