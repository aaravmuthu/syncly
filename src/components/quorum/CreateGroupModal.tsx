import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Modal } from "./Modal";
import { Button, Field, inputClass } from "./ui";
import { createGroup } from "@/lib/quorum/plan.functions";
import { uploadGroupImage } from "@/lib/quorum/group.functions";
import { COVER_THEMES, GROUP_EMOJI, GROUP_PRESET_IMAGES, coverTheme } from "@/lib/quorum/covers";
import { haptic } from "@/lib/quorum/haptics";
import { cn } from "@/lib/utils";

export function CreateGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("✨");
  const [kind, setKind] = useState<"permanent" | "temporary">("permanent");
  const [cover, setCover] = useState(COVER_THEMES[0]!.id);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const doUpload = useServerFn(uploadGroupImage);
  const theme = coverTheme(cover);

  const reset = () => {
    setName("");
    setEmoji("✨");
    setKind("permanent");
    setCover(COVER_THEMES[0]!.id);
    setAvatarUrl(null);
  };

  const create = useMutation({
    mutationFn: useServerFn(createGroup),
    onSuccess: (group) => {
      const g = group as unknown as { id: string; name: string };
      haptic("success");
      toast.success(`${g.name} is live`);
      reset();
      onClose();
      void qc.invalidateQueries({ queryKey: ["groups"] });
      void navigate({ to: "/groups/$groupId", params: { groupId: g.id } });
    },
    onError: (e: Error) => {
      haptic("warn");
      toast.error("Couldn't create that squad", { description: e.message });
    },
  });

  const onPick = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Could not read that file"));
        r.readAsDataURL(file);
      });
      const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
      const res = (await doUpload({ data: { dataUrl, ext } })) as { url: string };
      setAvatarUrl(res.url);
    } catch (e) {
      toast.error("Upload failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create a squad">
      {create.isError ? (
        <p role="alert" className="mb-3 text-sm text-destructive">
          Couldn't create that squad. {create.error.message}
        </p>
      ) : null}
      <div className={cn("relative h-24 overflow-hidden rounded-2xl", theme.banner)}>
        <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_10%_0%,rgba(255,255,255,0.18),transparent_60%)]" />
        <div className="absolute bottom-3 left-3 flex items-center gap-3">
          <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-background/70 text-2xl ring-1 ring-white/20 backdrop-blur">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              emoji
            )}
          </span>
          <span className="font-display text-base font-semibold text-white drop-shadow">
            {name.trim() || "New squad"}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <Field label="Squad name">
          <input
            className={inputClass}
            value={name}
            autoFocus
            maxLength={60}
            placeholder="Friday crew"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <div>
          <span className="text-sm font-medium">Group picture</span>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPick(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              loading={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload"}
            </Button>
            {GROUP_PRESET_IMAGES.map((url, index) => (
              <button
                key={url}
                aria-label={`Group picture ${index + 1}`}
                aria-pressed={avatarUrl === url}
                type="button"
                onClick={() => setAvatarUrl(url)}
                className={cn(
                  "tap-target h-11 w-11 overflow-hidden rounded-xl ring-1 transition",
                  avatarUrl === url ? "ring-2 ring-primary" : "ring-border hover:ring-primary/50",
                )}
              >
                <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
            {avatarUrl ? (
              <button
                type="button"
                onClick={() => setAvatarUrl(null)}
                className="rounded-xl px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <span className="text-sm font-medium">Icon</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {GROUP_EMOJI.map((e) => (
              <button
                key={e}
                aria-label={`Use ${e} icon`}
                aria-pressed={emoji === e}
                type="button"
                onClick={() => setEmoji(e)}
                className={cn(
                  "tap-target h-11 w-11 rounded-xl text-lg transition",
                  emoji === e ? "bg-primary/15 ring-1 ring-primary/40" : "bg-secondary",
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-sm font-medium">Cover style</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {COVER_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setCover(t.id)}
                className={cn(
                  "relative h-12 overflow-hidden rounded-2xl text-left ring-1 transition",
                  t.banner,
                  cover === t.id ? "ring-2 ring-primary" : "ring-white/10 hover:ring-primary/40",
                )}
              >
                <span className="absolute bottom-1.5 left-2.5 text-xs font-semibold text-white drop-shadow">
                  {t.label}
                </span>
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
              className={cn(
                "flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition",
                kind === k
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              {k === "permanent" ? "Ongoing" : "One-off"}
            </button>
          ))}
        </div>
      </div>

      <Button
        className="mt-4 w-full"
        loading={create.isPending}
        disabled={!name.trim() || uploading}
        onClick={() =>
          create.mutate({
            data: { name, emoji, kind, avatarUrl, coverTheme: cover },
          })
        }
      >
        {create.isPending ? "Creating…" : "Create squad"}
      </Button>
    </Modal>
  );
}
