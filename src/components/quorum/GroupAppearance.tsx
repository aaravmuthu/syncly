import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Field, inputClass } from "./ui";
import { updateGroupLook, uploadGroupImage } from "@/lib/quorum/group.functions";
import { COVER_THEMES, GROUP_EMOJI, GROUP_PRESET_IMAGES, coverTheme } from "@/lib/quorum/covers";
import { cn } from "@/lib/utils";

/** Admin-only editor for a squad's name, picture, icon and cover banner. */
export function GroupAppearance({
  groupId,
  initial,
}: {
  groupId: string;
  initial: {
    name: string;
    emoji?: string | null;
    avatar_url?: string | null;
    cover_theme?: string | null;
    kind?: string | null;
  };
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial.name);
  const [emoji, setEmoji] = useState(initial.emoji ?? "✨");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatar_url ?? null);
  const [cover, setCover] = useState(coverTheme(initial.cover_theme).id);
  const [uploading, setUploading] = useState(false);
  const doUpload = useServerFn(uploadGroupImage);
  const theme = coverTheme(cover);

  const save = useMutation({
    mutationFn: useServerFn(updateGroupLook),
    onSuccess: () => {
      toast.success("Squad look updated");
      void qc.invalidateQueries({ queryKey: ["group", groupId] });
      void qc.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (e: Error) => toast.error("Couldn't save that", { description: e.message }),
  });

  const onPick = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");
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
    <Card className="space-y-4">
      <h3 className="font-display text-base font-semibold">Squad look</h3>

      <div className={cn("relative h-20 overflow-hidden rounded-2xl", theme.banner)}>
        <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_10%_0%,rgba(255,255,255,0.18),transparent_60%)]" />
        <span className="absolute bottom-3 left-3 grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-background/70 text-xl ring-1 ring-white/20 backdrop-blur">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            emoji
          )}
        </span>
      </div>

      <Field label="Squad name">
        <input
          className={inputClass}
          value={name}
          maxLength={60}
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
          {GROUP_PRESET_IMAGES.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => setAvatarUrl(url)}
              className={cn(
                "h-10 w-10 overflow-hidden rounded-xl ring-1 transition",
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
              type="button"
              onClick={() => setEmoji(e)}
              className={cn(
                "h-9 w-9 rounded-xl text-lg transition",
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

      <Button
        className="w-full"
        loading={save.isPending}
        disabled={!name.trim() || uploading}
        onClick={() =>
          save.mutate({ data: { groupId, name, emoji, avatarUrl, coverTheme: cover } })
        }
      >
        Save look
      </Button>
    </Card>
  );
}
