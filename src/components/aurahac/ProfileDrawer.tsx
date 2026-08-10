import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Upload,
  Sparkles,
  ShieldCheck,
  Download,
  KeyRound,
  Trash2,
} from "lucide-react";
import { useHac } from "@/lib/hac/store";
import {
  AURA_PRESETS,
  AVATAR_PRESETS,
  emptyProfile,
  type StudentProfile,
} from "@/lib/hac/profile";
import { AuraAvatar } from "./AuraAvatar";

/**
 * Student Profile & Customization drawer: identity fields, animated avatar
 * picker (presets or uploaded PNG/JPG/GIF/APNG), aura border effects, Master
 * PIN setup and encrypted backup export / import.
 */
export function ProfileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    data,
    profile,
    setProfile,
    hasPin,
    setPin,
    clearPin,
    exportBackup,
    importBackup,
  } = useHac();

  const [draft, setDraft] = useState<StudentProfile>(profile);
  const [pinValue, setPinValue] = useState("");
  const [pass, setPass] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);

  function patch(p: Partial<StudentProfile>) {
    const next = { ...draft, ...p };
    setDraft(next);
    setProfile(next);
  }

  function onUpload(file: File | undefined) {
    if (!file) return;
    if (file.size > 4_000_000) {
      setNote("Image too large — keep it under 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch({ avatarImage: String(reader.result) });
    reader.readAsDataURL(file);
  }

  async function handleBackup() {
    if (pass.length < 6) {
      setNote("Use a backup passphrase of at least 6 characters.");
      return;
    }
    await exportBackup(pass);
    setNote("Encrypted backup downloaded.");
  }

  async function handleImport(file: File | undefined) {
    if (!file) return;
    try {
      await importBackup(file, pass);
      setNote("Backup restored.");
    } catch {
      setNote("Could not restore — wrong passphrase or bad file.");
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[10000] bg-black/60"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="fixed right-0 top-0 bottom-0 z-[10001] w-full sm:w-[420px] glass-strong overflow-y-auto p-5 space-y-6"
          >
            <header className="flex items-center justify-between">
              <h2 className="text-base font-bold tracking-tight">Student Profile</h2>
              <button onClick={onClose} className="h-9 w-9 rounded-xl grid place-items-center bg-white/5">
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* Live preview */}
            <div className="liquid rounded-2xl p-4 flex items-center gap-4">
              <AuraAvatar profile={draft} fallbackName={data?.student.name} size={72} />
              <div className="min-w-0">
                <div className="text-base font-bold truncate">
                  {draft.displayName || data?.student.name || "Your name"}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {draft.schoolName || data?.student.school || "School"}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 flex gap-2">
                  {draft.gradYear ? <span>Class of {draft.gradYear}</span> : null}
                  {draft.badgeId ? <span className="font-mono">#{draft.badgeId}</span> : null}
                </div>
              </div>
            </div>

            {/* Identity */}
            <section className="space-y-2">
              <Label>Personalization</Label>
              <Field label="Display name" value={draft.displayName} onChange={(v) => patch({ displayName: v })} />
              <Field label="High school" value={draft.schoolName} onChange={(v) => patch({ schoolName: v })} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Graduation year" value={draft.gradYear} onChange={(v) => patch({ gradYear: v })} />
                <Field label="Student ID badge" value={draft.badgeId} onChange={(v) => patch({ badgeId: v })} />
              </div>
            </section>

            {/* Avatar */}
            <section className="space-y-2">
              <Label>Animated avatar</Label>
              <div className="grid grid-cols-3 gap-2">
                {AVATAR_PRESETS.map((p) => {
                  const active = !draft.avatarImage && draft.avatarPreset === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => patch({ avatarPreset: p.id, avatarImage: null })}
                      className={`liquid rounded-2xl p-2.5 flex flex-col items-center gap-1.5 ${
                        active ? "ring-1 ring-primary" : ""
                      }`}
                    >
                      <AuraAvatar
                        profile={{ ...draft, avatarImage: null, avatarPreset: p.id, aura: "none" }}
                        fallbackName={data?.student.name}
                        size={44}
                      />
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">{p.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 rounded-xl bg-white/5 border border-white/10 py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" /> Upload PNG / JPG / GIF
                </button>
                {draft.avatarImage ? (
                  <button
                    onClick={() => patch({ avatarImage: null })}
                    className="rounded-xl bg-white/5 border border-white/10 px-3 text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/apng,image/webp"
                className="hidden"
                onChange={(e) => onUpload(e.target.files?.[0])}
              />
            </section>

            {/* Aura */}
            <section className="space-y-2">
              <Label>
                <Sparkles className="h-3 w-3 inline mr-1" /> Aura border effect
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {AURA_PRESETS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => patch({ aura: a.id })}
                    className={`liquid rounded-xl p-2.5 flex items-center gap-2 text-left ${
                      draft.aura === a.id ? "ring-1 ring-primary" : ""
                    }`}
                  >
                    <AuraAvatar
                      profile={{ ...draft, aura: a.id }}
                      fallbackName={data?.student.name}
                      size={32}
                    />
                    <span className="text-[11px] font-medium leading-tight">{a.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Security */}
            <section className="space-y-2">
              <Label>
                <ShieldCheck className="h-3 w-3 inline mr-1" /> Master PIN
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Locks your AES-256 encrypted grade ledger on this device.
              </p>
              <div className="flex gap-2">
                <input
                  value={pinValue}
                  onChange={(e) => setPinValue(e.target.value)}
                  type="password"
                  inputMode="numeric"
                  placeholder={hasPin ? "Current PIN" : "New 4-digit PIN"}
                  className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-primary/60"
                />
                <button
                  onClick={async () => {
                    try {
                      if (hasPin) {
                        await clearPin(pinValue);
                        setNote("PIN removed.");
                      } else {
                        if (pinValue.length < 4) return setNote("PIN must be at least 4 digits.");
                        await setPin(pinValue);
                        setNote("PIN set — you'll be asked for it next launch.");
                      }
                      setPinValue("");
                    } catch {
                      setNote("Incorrect PIN.");
                    }
                  }}
                  className="rounded-xl px-3.5 text-xs font-semibold inline-flex items-center gap-1.5"
                  style={{ background: "var(--primary)", color: "#090915" }}
                >
                  <KeyRound className="h-3.5 w-3.5" /> {hasPin ? "Remove" : "Set"}
                </button>
              </div>
            </section>

            {/* Backups */}
            <section className="space-y-2">
              <Label>Backup & migration</Label>
              <input
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                type="password"
                placeholder="Backup passphrase"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-primary/60"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => void handleBackup()}
                  className="flex-1 rounded-xl bg-white/5 border border-white/10 py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" /> Export .aurahac
                </button>
                <button
                  onClick={() => backupRef.current?.click()}
                  className="flex-1 rounded-xl bg-white/5 border border-white/10 py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" /> Import backup
                </button>
              </div>
              <input
                ref={backupRef}
                type="file"
                accept=".aurahac,application/json"
                className="hidden"
                onChange={(e) => void handleImport(e.target.files?.[0])}
              />
            </section>

            {note ? <p className="text-[11px] text-primary">{note}</p> : null}

            <button
              onClick={() => {
                const reset = emptyProfile();
                setDraft(reset);
                setProfile(reset);
              }}
              className="w-full rounded-xl bg-white/5 border border-white/10 py-2.5 text-xs text-muted-foreground"
            >
              Reset profile
            </button>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h3>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-primary/60"
      />
    </label>
  );
}
