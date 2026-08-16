import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/quorum/AppShell";
import { Button, Card, Empty, Field, inputClass, Skeleton } from "@/components/quorum/ui";
import { createGroup, joinGroup, listGroups } from "@/lib/quorum/plan.functions";

export const Route = createFileRoute("/_authenticated/groups/")({
  head: () => ({
    meta: [
      { title: "Your groups — Quorum" },
      {
        name: "description",
        content: "Create permanent or one-off groups, invite people with a code, and start plans together.",
      },
      { property: "og:title", content: "Your groups — Quorum" },
      { property: "og:description", content: "Create groups and plan together without sharing private limits." },
    ],
  }),
  component: GroupsPage,
});

const EMOJI = ["✨", "🍜", "🎬", "🏝️", "🎉", "🏓", "🚗", "🛍️", "🎟️", "🛋️"];

function GroupsPage() {
  const qc = useQueryClient();
  const groups = useQuery({ queryKey: ["groups"], queryFn: useServerFn(listGroups) });
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("✨");
  const [kind, setKind] = useState<"permanent" | "temporary">("permanent");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: useServerFn(createGroup),
    onSuccess: () => {
      setName("");
      void qc.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const join = useMutation({
    mutationFn: useServerFn(joinGroup),
    onSuccess: () => {
      setCode("");
      setError(null);
      void qc.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <AppShell title="Groups" subtitle="Permanent circles for the people you plan with, or a one-off group for a single event.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <h2 className="font-display text-base font-semibold">Create a group</h2>
          <div className="mt-4 space-y-3">
            <Field label="Group name">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Friday crew"
              />
            </Field>
            <div>
              <span className="text-sm font-medium">Icon</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EMOJI.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={`h-9 w-9 rounded-xl text-lg transition ${
                      emoji === e ? "bg-primary/15 ring-1 ring-primary/40" : "bg-secondary"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              {(["permanent", "temporary"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex-1 rounded-2xl px-3 py-2 text-sm font-medium capitalize transition ${
                    kind === k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {k === "permanent" ? "Ongoing" : "One-off"}
                </button>
              ))}
            </div>
            <Button
              className="w-full"
              disabled={!name.trim() || create.isPending}
              onClick={() => create.mutate({ data: { name, emoji, kind } })}
            >
              {create.isPending ? "Creating…" : "Create group"}
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-base font-semibold">Join with a code</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask whoever made the group for their six-character invite code.
          </p>
          <div className="mt-4 space-y-3">
            <input
              className={`${inputClass} text-center text-lg font-semibold uppercase tracking-[0.3em]`}
              value={code}
              maxLength={8}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
            />
            <Button
              variant="outline"
              className="w-full"
              loading={join.isPending}
              disabled={code.length < 4 || join.isPending}
              onClick={() => join.mutate({ data: { code } })}
            >
              {join.isPending ? "Joining…" : "Join group"}
            </Button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Your groups
        </h2>
        {groups.isLoading ? <Skeleton className="h-20 rounded-3xl" /> : null}
        {!groups.isLoading && (groups.data ?? []).length === 0 ? (
          <Empty title="No groups yet" body="Create one above and share the invite code." />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {(groups.data ?? []).map((raw) => {
            const g = raw as unknown as Record<string, unknown>;
            const id = String(g["id"]);
            return (
              <Link key={id} to="/groups/$groupId" params={{ groupId: id }}>
                <Card className="flex items-center justify-between transition hover:border-primary/40">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{String(g["emoji"] ?? "✨")}</span>
                    <div>
                      <p className="font-semibold">{String(g["name"])}</p>
                      <p className="text-xs text-muted-foreground">
                        {String(g["member_count"] ?? 1)} members · code {String(g["invite_code"] ?? "")}
                      </p>
                    </div>
                  </div>
                  <span className="text-muted-foreground">›</span>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
