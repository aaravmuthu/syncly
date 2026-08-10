import { useState } from "react";
import { useHac, type Theme } from "@/lib/hac/store";
import { DISTRICTS } from "@/lib/hac/types";
import { AuraAvatar } from "../AuraAvatar";
import { ProfileDrawer } from "../ProfileDrawer";
import { LogOut, Trash2, Palette, User as UserIcon, RefreshCcw, Pencil, Check } from "lucide-react";


const THEMES: { id: Theme; label: string; vibe: string; canvas: string; accent: string }[] = [
  { id: "nebula", label: "Nebula", vibe: "Cosmic tech", canvas: "#080D2E", accent: "#6040DC" },
  { id: "onyx", label: "Onyx", vibe: "Monochrome", canvas: "#000000", accent: "#FFFFFF" },
  { id: "executive", label: "Executive", vibe: "Editorial gold", canvas: "#0A0A0A", accent: "#C9A24A" },
  { id: "arctic", label: "Arctic", vibe: "Light SaaS", canvas: "#FFFFFF", accent: "#4F46E5" },
  { id: "titanium", label: "Titanium", vibe: "Industrial", canvas: "#17191C", accent: "#A8B8CC" },
  { id: "phantom", label: "Phantom Jade", vibe: "Neon emerald", canvas: "#050706", accent: "#34D399" },
  { id: "genesis", label: "Cyber Genesis", vibe: "Tactical synth", canvas: "#070610", accent: "#FF2D90" },
  { id: "platinum", label: "Ghost Platinum", vibe: "Icy minimalist", canvas: "#0C0C0C", accent: "#E8ECF1" },
];

/** Small uppercase tracked-out section header used to group the settings stack. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground px-1 pt-1">
      {children}
    </div>
  );
}

export function SettingsTab() {
  const { data, logout, refresh, loading, theme, setTheme } = useHac();
  const [editing, setEditing] = useState(false);
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
    <div className="space-y-6 pb-32 max-w-2xl mx-auto">
      <header className="pt-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">System</div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </header>

      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />

      <SectionLabel>Personalization & Security</SectionLabel>
      <section className="glass p-4 flex items-center gap-3">
        <AuraAvatar profile={profile} fallbackName={data.student.name} size={52} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">
            {profile.displayName || data.student.name}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Animated avatar, aura effects, Master PIN & encrypted backups
          </div>
        </div>
        <button
          onClick={() => setProfileOpen(true)}
          className="rounded-xl px-3 py-2 text-xs font-semibold shrink-0"
          style={{ background: "var(--primary)", color: "#090915" }}
        >
          Customize
        </button>
      </section>



      {/* ===== Profile card — consolidated, pencil-on-avatar edit ===== */}
      <section className="glass p-4">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="h-14 w-14 rounded-2xl bg-primary grid place-items-center">
              <UserIcon className="h-6 w-6 text-primary-foreground" />
            </div>
            <button
              onClick={() => setEditing((v) => !v)}
              aria-label={editing ? "Done editing profile" : "Edit profile"}
              className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full grid place-items-center bg-card border border-border text-foreground shadow-sm transition-all hover:border-primary/60 hover:text-primary active:scale-90"
            >
              {editing ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold truncate">{data.student.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {district?.name} · @{data.username}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Last synced {new Date(data.syncedAt).toLocaleString()}
            </div>
          </div>
        </div>

        {editing ? (
          <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2">
            <button className="rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
              Change Name
            </button>
            <button className="rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
              Profile Picture
            </button>
          </div>
        ) : null}
      </section>

      {/* ===== PERSONALIZATION ===== */}
      <div className="space-y-3">
        <SectionLabel>Personalization</SectionLabel>
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
      </div>

      {/* ===== SECURITY & DATA ===== */}
      <div className="space-y-3">
        <SectionLabel>Security &amp; Data</SectionLabel>

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
      </div>

      {/* ===== Low-profile destructive action ===== */}
      <div className="pt-2 flex justify-center">
        <button
          onClick={logout}
          className="group inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive/80 transition-all hover:border-destructive hover:text-destructive-foreground hover:bg-destructive hover:shadow-[0_8px_28px_-6px_oklch(0.68_0.24_25_/_0.6)] active:scale-[0.97]"
        >
          <LogOut className="h-4 w-4" />
          Disconnect Account
        </button>
      </div>
    </div>
  );
}
