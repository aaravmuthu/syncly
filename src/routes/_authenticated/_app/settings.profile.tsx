import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { UserCog, UserRound } from "lucide-react";
import { SubpageHeader } from "@/components/quorum/AppShell";
import { PushEnter } from "@/components/quorum/interactions";
import { Card, Field, Skeleton, inputClass } from "@/components/quorum/ui";
import { Switch } from "@/components/ui/switch";
import { SectionHeader } from "@/components/quorum/settings/shared";
import { getMe, saveProfile, uploadAvatar } from "@/lib/quorum/plan.functions";
import { Avatar } from "@/components/quorum/Avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MobileActions } from "@/components/quorum/MobileActions";
import { DynamicButton } from "@/components/quorum/DynamicButton";

export const Route = createFileRoute("/_authenticated/_app/settings/profile")({
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData({ queryKey: ["me"], queryFn: () => getMe() });
  },
  head: () => ({
    meta: [{ title: "Profile — Syncly" }],
  }),
  component: ProfilePage,
});

const AVATARS = ["🙂", "😎", "🦊", "🐼", "🌵", "🍄", "⚡", "🌙", "🎧", "🧃"];

function ProfilePage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe) });
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [uploading, setUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const doUpload = useServerFn(uploadAvatar);

  useEffect(() => {
    if (me.data) setForm(me.data as unknown as Record<string, unknown>);
  }, [me.data]);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation<unknown, Error, { data: Record<string, unknown> }>({
    mutationFn: useServerFn(saveProfile),
    onSuccess: (_res, vars) => {
      // Merge the saved fields into the cached profile instead of
      // invalidating — a refetch would reset the form and wipe fields the
      // user is still editing (name, bio, a just-picked emoji).
      const patch = vars.data;
      qc.setQueryData(["me"], (old: unknown) =>
        old && typeof old === "object" ? { ...(old as Record<string, unknown>), ...patch } : old,
      );
      toast.success("Saved");
    },
    onError: (e: unknown) =>
      toast.error("Couldn't save", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
  });

  async function onPickAvatar(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read that file"));
        reader.readAsDataURL(file);
      });
      const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
      const res = await doUpload({ data: { dataUrl, ext } });
      set("avatar_url", res.avatar_url);
      qc.setQueryData(["me"], (old: unknown) =>
        old && typeof old === "object"
          ? { ...(old as Record<string, unknown>), avatar_url: res.avatar_url }
          : old,
      );
      toast.success("Photo updated");
    } catch (e) {
      toast.error("Couldn't upload that image", {
        description: e instanceof Error ? e.message : "Please try another file.",
      });
    } finally {
      setUploading(false);
    }
  }

  if (me.isLoading) {
    return (
      <PushEnter>
        <SubpageHeader title="Profile" backTo="/settings" />
        <Skeleton className="h-40 rounded-surface" />
      </PushEnter>
    );
  }

  const isGuardian = (form["account_type"] ?? "teen") === "guardian";

  return (
    <PushEnter>
      <SubpageHeader title="Profile" backTo="/settings" />

      <Card className="space-y-4">
        <SectionHeader icon={UserRound} title="Profile" />
        <div className="flex items-center gap-4">
          <Avatar
            url={form["avatar_url"] as string | null}
            emoji={String(form["avatar_emoji"] ?? "🙂")}
            name={String(form["display_name"] ?? "")}
            size={64}
          />
          <div className="space-y-1">
            <label className="tap-target pressable active:pressable-active inline-flex cursor-pointer items-center rounded-full border border-input px-4 text-sm font-medium transition-colors hover:bg-secondary">
              {uploading ? "Uploading…" : "Upload photo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={(e) => void onPickAvatar(e.target.files?.[0])}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, GIF or WebP — animation is kept. Max 5 MB.
            </p>
            {form["avatar_url"] ? (
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground underline"
                onClick={() => {
                  set("avatar_url", null);
                  save.mutate({ data: { avatar_url: null } });
                }}
              >
                Remove photo
              </button>
            ) : null}
          </div>
        </div>
        {form["avatar_url"] && !showEmojiPicker ? (
          <button
            type="button"
            className="text-left text-xs font-medium text-muted-foreground underline"
            onClick={() => setShowEmojiPicker(true)}
          >
            Use an emoji instead
          </button>
        ) : (
          <div>
            <span className="text-sm font-medium">Avatar</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => {
                    set("avatar_emoji", a);
                    if (form["avatar_url"]) {
                      set("avatar_url", null);
                      save.mutate({ data: { avatar_url: null, avatar_emoji: a } });
                    }
                  }}
                  aria-label={`Use ${a} as avatar`}
                  aria-pressed={!form["avatar_url"] && form["avatar_emoji"] === a}
                  className={cn(
                    "tap-target h-11 w-11 rounded-2xl text-lg transition",
                    !form["avatar_url"] && form["avatar_emoji"] === a
                      ? "bg-primary/15 ring-1 ring-primary/40"
                      : "bg-secondary",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}
        <Field label="Display name">
          <input
            className={inputClass}
            value={String(form["display_name"] ?? "")}
            onChange={(e) => set("display_name", e.target.value)}
          />
        </Field>
        <Field label="Bio" hint="Optional — up to 160 characters">
          <textarea
            className={cn(inputClass, "min-h-20 resize-y")}
            maxLength={160}
            value={String(form["bio"] ?? "")}
            onChange={(e) => set("bio", e.target.value)}
            placeholder="Two lines about you"
          />
        </Field>
      </Card>

      {/* I use Syncly as — an identity field, not a preference, so it lives
          on Profile alongside name/avatar rather than deeper in Account. */}
      <Card className="mt-4 space-y-4">
        <SectionHeader
          icon={UserCog}
          title="I use Syncly as"
          subtitle="Parents get the Family hub. Teens get the pairing code and safety tools."
        />
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: "teen", label: "Teen", icon: "🎒" },
              { id: "guardian", label: "Parent", icon: "🛡️" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                set("account_type", opt.id);
                save.mutate({ data: { account_type: opt.id } });
              }}
              aria-pressed={(form["account_type"] ?? "teen") === opt.id}
              className={cn(
                "tap-target inline-flex items-center justify-center rounded-2xl border px-3 text-sm font-medium transition",
                (form["account_type"] ?? "teen") === opt.id
                  ? "border-primary/50 bg-primary/10"
                  : "border-border hover:bg-secondary",
              )}
            >
              <span className="mr-1.5" aria-hidden>
                {opt.icon}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Phone — personal contact info, kept here with its own sharing
          toggle rather than split across Profile and Account. */}
      <Card className="mt-4 space-y-4">
        <SectionHeader
          icon={UserRound}
          title="Contact info"
          subtitle={
            isGuardian
              ? "Only shared with your linked teens if you allow it below."
              : "Only shared with linked parents if you allow it below."
          }
        />
        <Field label="Phone">
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className={inputClass}
            value={String(form["phone"] ?? "")}
            placeholder="(555) 555-5555"
            onChange={(e) => set("phone", e.target.value)}
            onBlur={() => save.mutate({ data: { phone: form["phone"] } })}
          />
        </Field>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
          <button
            type="button"
            className="flex-1 text-left"
            onClick={() => {
              const next = !form["share_contact_with_parents"];
              set("share_contact_with_parents", next);
              save.mutate({ data: { share_contact_with_parents: next } });
            }}
          >
            <span className="block text-sm font-medium">
              Share my number with parents on the plan
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Off by default. Never visible to your squad — only linked parents, only if you turn
              this on.
            </span>
          </button>
          <Switch
            checked={Boolean(form["share_contact_with_parents"])}
            onCheckedChange={(checked) => {
              set("share_contact_with_parents", checked);
              save.mutate({ data: { share_contact_with_parents: checked } });
            }}
            aria-label="Share my number with parents on the plan"
          />
        </div>
      </Card>

      <MobileActions className="mt-5">
        <DynamicButton
          loading={save.isPending}
          onClick={() =>
            save.mutate({
              data: {
                avatar_emoji: form["avatar_emoji"],
                display_name: form["display_name"],
                bio: form["bio"],
              },
            })
          }
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </DynamicButton>
      </MobileActions>
    </PushEnter>
  );
}
