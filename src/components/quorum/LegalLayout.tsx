import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/quorum/Wordmark";
import { BRAND } from "@/lib/brand";

/**
 * Shared shell for long-form legal pages (Privacy Policy, Terms of Service).
 * Mirrors the site's dark-glass shell (paper-field background, card-surface
 * panels, same header/footer treatment as auth.tsx / index.tsx) but keeps
 * the body itself plain and readable — this is a document, not a UI screen.
 */
export function LegalLayout({
  title,
  effectiveDate,
  dateLabel = "Effective date",
  intro,
  toc,
  children,
}: {
  title: string;
  effectiveDate: string;
  dateLabel?: string;
  intro?: React.ReactNode;
  toc?: { id: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="paper-field min-h-dvh [overflow-wrap:anywhere] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
      <header className="liquid-bar liquid-bar-docked safe-top sticky top-0 z-30">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-2.5">
          <Link to="/" className="tap-target inline-flex items-center">
            <Wordmark size="sm" />
          </Link>
          <Link
            to="/"
            className="tap-target inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pt-10 pb-24">
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {dateLabel}: {effectiveDate}
        </p>

        {intro ? (
          <div className="mt-6 text-base leading-relaxed text-muted-foreground">{intro}</div>
        ) : null}

        {toc && toc.length > 0 ? (
          <nav aria-label="On this page" className="card-surface mt-8 p-5">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              On this page
            </p>
            <ol className="mt-2 grid sm:grid-cols-2 sm:gap-x-4">
              {toc.map((t, i) => (
                <li key={t.id}>
                  <a
                    href={`#${t.id}`}
                    className="flex min-h-11 items-center text-sm text-foreground/90 underline-offset-4 hover:text-primary hover:underline"
                  >
                    {i + 1}. {t.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="mt-10 space-y-10">{children}</div>
      </main>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-5 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <Wordmark size="sm" />
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link
              to="/privacy"
              className="tap-target inline-flex items-center transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="tap-target inline-flex items-center transition-colors hover:text-foreground"
            >
              Terms
            </Link>
            <Link
              to="/subprocessors"
              className="tap-target inline-flex items-center hover:text-foreground"
            >
              Service providers
            </Link>
            <Link
              to="/accessibility"
              className="tap-target inline-flex items-center transition-colors hover:text-foreground"
            >
              Accessibility
            </Link>
            <span>
              © {new Date().getFullYear()} {BRAND.name}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
      <div className="mt-3 space-y-4 text-base leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <div className="mt-2 space-y-3 text-base leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Visually flags a placeholder the site owner must fill in with real information. */
export function Ph({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-700 ring-1 ring-amber-500/30 ring-inset dark:text-amber-400">
      {children}
    </span>
  );
}
