import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/quorum/AppShell";
import { Button, Card, Pill } from "@/components/quorum/ui";
import { runRlsSelfCheck } from "@/lib/quorum/rlscheck.functions";

export const Route = createFileRoute("/_authenticated/_app/rls-check")({
  component: RlsCheckPage,
  head: () => ({
    meta: [
      { title: "Security self-check · Syncly" },
      {
        name: "description",
        content:
          "Run a live check that Syncly's database rules still block edits and deletes on other people's data.",
      },
      { property: "og:title", content: "Security self-check · Syncly" },
      {
        property: "og:description",
        content:
          "Verify that other members can never edit or delete your plans, profile or alerts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function RlsCheckPage() {
  const run = useMutation({ mutationFn: useServerFn(runRlsSelfCheck) });
  const result = run.data;

  return (
    <>
      <PageHeader
        title="Security self-check"
        subtitle="Confirm nobody else can edit or delete your data"
      />
      <Card className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This runs a live probe against the database: temporary rows are created for a fake other
          user, your own session then tries to update and delete them, and every attempt must be
          refused. The probe rows are removed straight after.
        </p>
        <Button
          loading={run.isPending}
          orb="working"
          onClick={() => run.mutate({ data: undefined as never })}
        >
          Run check
        </Button>

        {run.error ? (
          <p className="text-sm text-destructive">{(run.error as Error).message}</p>
        ) : null}

        {result ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Pill tone={result.passed ? "good" : "bad"}>
                {result.passed ? "All rules holding" : "Action needed"}
              </Pill>
              <span className="text-xs text-muted-foreground">
                {new Date(result.ranAt).toLocaleTimeString()}
              </span>
            </div>
            <ul className="space-y-1.5">
              {result.checks.map((c) => (
                <li
                  key={c.name}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-border px-3 py-2 text-sm"
                >
                  <span>{c.name}</span>
                  <span
                    className={
                      c.passed
                        ? "shrink-0 text-xs text-success"
                        : "shrink-0 text-xs text-destructive"
                    }
                  >
                    {c.passed ? "denied ✓" : `ALLOWED — ${c.detail}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </>
  );
}
