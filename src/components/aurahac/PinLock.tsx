import { useState } from "react";
import { motion } from "motion/react";
import { Lock, ShieldCheck } from "lucide-react";
import { useHac } from "@/lib/hac/store";

/** Master PIN gate shown when the encrypted local ledger is locked. */
export function PinLock() {
  const { unlock } = useHac();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await unlock(pin);
    } catch {
      setErr("Incorrect PIN. Try again.");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-0 grid place-items-center px-6">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong rounded-3xl p-7 w-full max-w-sm space-y-5"
      >
        <div className="flex items-center gap-3">
          <span
            className="h-11 w-11 rounded-2xl grid place-items-center"
            style={{ background: "color-mix(in oklab, var(--primary) 18%, transparent)" }}
          >
            <Lock className="h-5 w-5 text-primary" />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Grade ledger locked</h1>
            <p className="text-xs text-muted-foreground">Enter your Master PIN to decrypt.</p>
          </div>
        </div>

        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          type="password"
          inputMode="numeric"
          autoFocus
          placeholder="••••"
          className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-primary/60"
        />

        {err ? <p className="text-xs text-destructive text-center">{err}</p> : null}

        <button
          type="submit"
          disabled={busy || pin.length < 4}
          className="w-full rounded-2xl py-3 font-semibold text-sm disabled:opacity-40"
          style={{ background: "var(--primary)", color: "#090915" }}
        >
          {busy ? "Decrypting…" : "Unlock"}
        </button>

        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 justify-center">
          <ShieldCheck className="h-3.5 w-3.5" /> AES-256 encrypted on this device only
        </p>
      </motion.form>
    </div>
  );
}
