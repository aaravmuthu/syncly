import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronRight, Info, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { SubpageHeader } from "@/components/quorum/AppShell";
import { PushEnter } from "@/components/quorum/interactions";
import { Card } from "@/components/quorum/ui";
import { SectionHeader } from "@/components/quorum/settings/shared";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/_app/settings/info")({
  head: () => ({
    meta: [{ title: "Info & about — Syncly" }],
  }),
  component: InfoPage,
});

const APP_VERSION = "1.0.0";

function LinkRow({
  icon: Icon,
  label,
  hint,
  href,
  to,
}: {
  icon: typeof Info;
  label: string;
  hint?: string;
  href?: string;
  to?: string;
}) {
  const content = (
    <>
      <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      {href ? (
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
    </>
  );
  const className =
    "tap-target pressable active:pressable-active flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-left transition-colors hover:bg-secondary";
  return href ? (
    <a
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel="noreferrer"
      className={className}
    >
      {content}
    </a>
  ) : (
    <Link to={to!} className={className}>
      {content}
    </Link>
  );
}

function InfoPage() {
  return (
    <PushEnter>
      <SubpageHeader title="Info & about" backTo="/settings" />

      <Card className="space-y-1">
        <SectionHeader icon={Info} title={BRAND.name} subtitle={BRAND.tagline} />
        <p className="pt-2 text-xs text-muted-foreground">Version {APP_VERSION}</p>
      </Card>

      <Card className="mt-4 space-y-1">
        <SectionHeader icon={ShieldCheck} title="Legal & support" />
        <div className="mt-1 divide-y divide-border">
          <LinkRow icon={Lock} label="Privacy Policy" to="/privacy" />
          <LinkRow icon={Info} label="Terms of Service" to="/terms" />
          <LinkRow
            icon={Mail}
            label="Contact support"
            hint="We reply within a couple of days"
            href="mailto:support@syncly.website"
          />
        </div>
      </Card>

      <Card className="mt-4 space-y-3">
        <SectionHeader icon={Sparkles} title="How Syncly works" />
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            Everyone answers a private questionnaire — no one else on the group ever sees your
            individual answers.
          </li>
          <li>
            Syncly's matching engine finds plans that work for everyone, then ranks them fairly so
            the same person isn't always the one who compromises.
          </li>
          <li>
            The group only ever sees whether an option works for the whole squad, never who it
            didn't work for or why.
          </li>
          <li>
            Parents linked to a teen's plan see that plan's safety details only — never
            questionnaire answers or unrelated activity.
          </li>
        </ul>
      </Card>
    </PushEnter>
  );
}
