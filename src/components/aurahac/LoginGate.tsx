import { useState } from "react";
import { useHac } from "@/lib/hac/store";
import { DISTRICTS, type DistrictId } from "@/lib/hac/types";
import { Loader2, ShieldCheck, Lock, Sparkles } from "lucide-react";

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

  return (
    <div className="absolute inset-0 flex items-center justify-center p-5 overflow-y-auto">
      <div className="glass-strong w-full max-w-sm p-6 rounded-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-2xl bg-primary grid place-items-center glow-primary">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight">AuraHAC</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Secure HAC Sync</div>
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-1">Sync Account</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Sign in with your school portal credentials. We use them only to fetch your grades and never store them on our servers.
        </p>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">District</span>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value as DistrictId)}
              className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-primary/60"
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
              className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-primary/60"
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
              className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-primary/60"
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
            className="w-full mt-2 rounded-2xl py-3.5 font-semibold text-base bg-primary text-primary-foreground shadow-[var(--shadow-elegant)] active:scale-95 transition-all duration-200 disabled:opacity-60"
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

        <div className="flex items-center gap-3 my-4">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={loginDemo}
          className="w-full rounded-2xl py-3.5 font-semibold text-base text-foreground bg-white/[0.03] hover:bg-white/[0.06] active:scale-95 transition-all duration-200"
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


        <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          End-to-end secure. Credentials are sent directly to your district's HAC.
        </div>
      </div>
    </div>
  );
}