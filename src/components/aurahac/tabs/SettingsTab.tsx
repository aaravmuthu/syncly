import { useHac, type Theme } from "@/lib/hac/store";
import { DISTRICTS } from "@/lib/hac/types";
import { LogOut, Trash2, Palette, User as UserIcon, RefreshCcw } from "lucide-react";

const THEMES: { id: Theme; label: string; vibe: string; canvas: string; accent: string }[] = [
  { id: "nebula", label: "Nebula", vibe: "Cosmic tech", canvas: "#080D2E", accent: "#6040DC" },
  { id: "onyx", label: "Onyx", vibe: "Monochrome", canvas: "#000000", accent: "#FFFFFF" },
  { id: "executive", label: "Executive", vibe: "Editorial gold", canvas: "#0A0A0A", accent: "#C9A24A" },
  { id: "arctic", label: "Arctic", vibe: "Light SaaS", canvas: "#FFFFFF", accent: "#4F46E5" },
  { id: "titanium", label: "Titanium", vibe: "Industrial", canvas: "#17191C", accent: "#A8B8CC" },
  { id: "amethyst", label: "Amethyst", vibe: "Luxury violet", canvas: "#0D0820", accent: "#A78BFA" },
];

export function SettingsTab() {
  const { data, logout, refresh, loading, theme, setTheme } = useHac();
  if (!data) return null;
  const district = DISTRICTS.find((d) => d.id === data.districtId);

  function clearCache() {
    try {
      localStorage.removeItem("aurahac.data.v1");
      location.reload();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-4 pb-32">
      <header className="pt-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">System</div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </header>

      <section className="glass p-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Profile</div>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary grid place-items-center">
            <UserIcon className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{data.student.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{district?.name} · @{data.username}</div>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground mt-3">
          Last synced {new Date(data.syncedAt).toLocaleString()}
        </div>
      </section>

      <section className="glass p-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 inline-flex items-center gap-1">
          <Palette className="h-3 w-3" /> Workspace Theme
        </div>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => {
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`p-3 rounded-xl flex items-center gap-3 border text-left transition-all active:scale-[0.97] ${
                  active
                    ? "border-primary/60 shadow-[var(--shadow-elegant)] bg-secondary"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <span
                  className="h-9 w-9 rounded-lg shrink-0 grid place-items-center"
                  style={{ background: t.canvas, border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{ background: t.accent, boxShadow: `0 0 12px ${t.accent}` }}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold truncate">{t.label}</span>
                  <span className="block text-[10px] text-muted-foreground truncate">{t.vibe}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>


      <button
        onClick={refresh}
        disabled={loading}
        className="glass w-full p-4 flex items-center justify-between active:scale-[0.98] transition-all"
      >
        <span className="inline-flex items-center gap-3">
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          <span className="text-sm font-medium">Refresh Live Data</span>
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Now</span>
      </button>

      <button
        onClick={clearCache}
        className="glass w-full p-4 flex items-center justify-between active:scale-[0.98] transition-all"
      >
        <span className="inline-flex items-center gap-3">
          <Trash2 className="h-4 w-4" />
          <span className="text-sm font-medium">Clear Cached Data</span>
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Reset</span>
      </button>

      <button
        onClick={logout}
        className="w-full p-4 rounded-md text-base font-semibold text-destructive-foreground bg-destructive shadow-[0_8px_32px_-4px_oklch(0.68_0.24_25_/_0.6)] active:scale-[0.97] transition-all flex items-center justify-center gap-2"
      >
        <LogOut className="h-4 w-4" />
        Disconnect Account
      </button>
    </div>
  );
}