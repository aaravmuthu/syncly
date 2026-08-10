import logoAsset from "@/assets/aurahac-logo.png.asset.json";
import { useEffect, useState } from "react";
import { useHac } from "@/lib/hac/store";
import { DISTRICTS, type DistrictId } from "@/lib/hac/types";
import { Loader2, ShieldCheck, Lock, Sparkles } from "lucide-react";
import { GradeRing } from "./GradeRing";

const TIERS = [
  { name: "Vanguard", desc: "The first ascent. Momentum begins here." },
  { name: "Lucid", desc: "Clarity unlocked. Patterns become visible." },
  { name: "Zenith", desc: "Peak focus. Grades trending upward." },
  { name: "Radiant", desc: "Consistency shines. Streaks stay alive." },
  { name: "Apex", desc: "The summit. Elite academic command." },
];

function TierCarousel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % TIERS.length), 5000);
    return () => clearInterval(t);
  }, []);
  const tier = TIERS[i];
  return (
    <div className="mt-10 w-full max-w-xs">
      <div className="text-[10px] uppercase tracking-[0.25em] text-center mb-3 text-[color-mix(in_oklab,var(--primary)_70%,white)]">
        Elite Rank Tiers
      </div>
      <div
        key={tier.name}
        className="rounded-2xl px-5 py-4 text-center animate-in fade-in slide-in-from-bottom-2 duration-700"
        style={{
          background: "rgba(13, 13, 30, 0.55)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="text-lg font-bold tracking-tight text-white">{tier.name}</div>
        <div className="text-[11px] text-white/55 mt-0.5">{tier.desc}</div>
      </div>
      <div className="flex justify-center gap-1.5 mt-3">
        {TIERS.map((_, idx) => (
          <span
            key={idx}
            className="h-1.5 rounded-full transition-all duration-500"
            style={{
              width: idx === i ? 18 : 6,
              background: idx === i ? "var(--primary)" : "rgba(255,255,255,0.2)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function LoginGate() {
  const { login, loginDemo, loading, error } = useHac();
  const [district, setDistrict] = useState<DistrictId>("frisco");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login({ district, username, password });
    } catch {
      /* error shown below */
    }
  }

  const fieldClass =
    "mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-base transition-shadow duration-150 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-[color-mix(in_oklab,var(--primary)_55%,transparent)]";

  const card = (
    <div className="glass-strong w-full max-w-sm md:max-w-[540px] p-6 md:p-6 rounded-3xl">
      <div className="flex items-center gap-3 mb-5">
        <img
          src={logoAsset.url}
          alt="AuraHAC logo"
          className="h-10 w-10 rounded-2xl object-cover glow-primary"
        />
        <div>
          <div className="text-xl font-bold tracking-tight">AuraHAC</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Secure HAC Sync</div>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-1">Sync Account</h1>
      <p className="text-sm text-muted-foreground mb-3">
        Sign in with your school portal credentials. Your password is
        encrypted locally on this device and is never stored on any external
        database — it's used only to pull your grades directly from your
        district's portal.
      </p>

      <div
        className="mb-4 rounded-2xl p-3 flex items-start gap-2.5"
        style={{
          background: "color-mix(in oklab, var(--primary) 10%, transparent)",
          border: "1px solid color-mix(in oklab, var(--primary) 28%, transparent)",
        }}
      >
        <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <div className="text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Local-first encryption.</span>{" "}
          Credentials are encrypted with a device-only key (AES-GCM) and stay
          on your phone. No third-party server ever sees or stores them.
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-2.5">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">District</span>
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value as DistrictId)}
            className={fieldClass}
          >
            {DISTRICTS.map((d) => (
              <option key={d.id} value={d.id} className="bg-[#0a0d14]">
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className={fieldClass}
          />
        </label>
        {error ? (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">
            {error}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 rounded-2xl py-3 font-semibold text-base bg-primary text-primary-foreground shadow-[var(--shadow-elegant)] active:scale-95 transition-all duration-200 disabled:opacity-60"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Connecting…
            </span>
          ) : (
            "Connect Account"
          )}
        </button>
      </form>

      <div className="flex items-center gap-3 my-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        type="button"
        onClick={loginDemo}
        className="w-full rounded-2xl py-3 font-semibold text-base text-foreground bg-white/[0.03] hover:bg-white/[0.06] active:scale-95 transition-all duration-200"
        style={{
          border: "1px solid rgba(160, 32, 240, 0.4)",
          boxShadow: "0 0 18px -4px rgba(160, 32, 240, 0.45), inset 0 0 12px -8px rgba(160, 32, 240, 0.6)",
        }}
      >
        <span className="inline-flex items-center gap-2 justify-center">
          <Sparkles className="h-4 w-4" />
          Explore with Demo Student
        </span>
      </button>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Lock className="h-3 w-3" />
        Encrypted on-device · sent directly to your district's HAC · never stored externally.
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 md:grid md:grid-cols-2 md:h-screen md:w-full md:overflow-hidden">
      {/* Left: branding (desktop only) */}
      <div
        className="hidden md:flex relative flex-col items-center justify-center overflow-hidden p-12"
        style={{ background: "#090915" }}
      >
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: 720,
            height: 720,
            background:
              "radial-gradient(circle, rgba(160,32,240,0.28) 0%, rgba(160,32,240,0.08) 40%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div className="relative flex flex-col items-center">
          <div className="drop-shadow-[0_0_40px_rgba(160,32,240,0.5)]">
            <GradeRing value={96.4} size={220} label="GPA" />
          </div>
          <div className="mt-8 text-center">
            <div className="text-5xl lg:text-6xl font-bold tracking-tight text-white">AuraHAC</div>
            <div className="mt-3 text-xs lg:text-sm uppercase tracking-[0.35em] text-[color-mix(in_oklab,var(--primary)_55%,white)] drop-shadow-[0_0_12px_rgba(160,32,240,0.5)]">
              The Academic Command Center
            </div>
          </div>
          <TierCarousel />
        </div>
      </div>

      {/* Right: login command deck */}
      <div className="absolute inset-0 md:relative md:inset-auto flex items-center justify-center p-5 md:p-6 lg:p-8 overflow-y-auto">
        {card}
      </div>
    </div>
  );
}
