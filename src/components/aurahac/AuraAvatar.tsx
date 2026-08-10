import { AVATAR_PRESETS, auraFor, avatarFor, initialsOf, type StudentProfile } from "@/lib/hac/profile";

/**
 * Animated student avatar. Renders either the uploaded image (PNG/JPG/GIF/APNG
 * all animate natively in an <img>) or a CSS-animated vector preset, wrapped in
 * the selected "Aura" border effect.
 */
export function AuraAvatar({
  profile,
  fallbackName,
  size = 48,
}: {
  profile: StudentProfile;
  fallbackName?: string;
  size?: number;
}) {
  const aura = auraFor(profile.aura);
  const preset = avatarFor(profile.avatarPreset);
  const ringed = profile.aura !== "none";
  const pad = Math.max(2, Math.round(size * 0.06));

  return (
    <span
      className={`relative inline-grid place-items-center rounded-full shrink-0 ${ringed ? "aura-ring" : ""}`}
      style={{
        width: size,
        height: size,
        padding: pad,
        // Rotating conic gradient ring + soft outer glow.
        background: ringed
          ? `conic-gradient(from 0deg, ${aura.color}, ${aura.color2}, ${aura.color})`
          : "color-mix(in oklab, var(--primary) 18%, transparent)",
        boxShadow: ringed ? `0 0 ${Math.round(size * 0.4)}px -${Math.round(size * 0.18)}px ${aura.color}` : undefined,
      }}
    >
      <span
        className="relative rounded-full overflow-hidden grid place-items-center w-full h-full"
        style={{ background: "var(--background)" }}
      >
        {profile.avatarImage ? (
          <img
            src={profile.avatarImage}
            alt={`${profile.displayName || fallbackName || "Student"} avatar`}
            className="w-full h-full object-cover"
          />
        ) : (
          <PresetArt id={preset.id} colors={preset.colors} label={initialsOf(profile.displayName || fallbackName || "")} size={size} />
        )}
      </span>
    </span>
  );
}

function PresetArt({
  id,
  colors,
  label,
  size,
}: {
  id: (typeof AVATAR_PRESETS)[number]["id"];
  colors: [string, string];
  label: string;
  size: number;
}) {
  const [a, b] = colors;
  const common = "absolute inset-0";
  return (
    <span className="relative w-full h-full grid place-items-center overflow-hidden">
      {id === "orb" ? (
        <span
          className={`${common} avatar-drift`}
          style={{ background: `radial-gradient(circle at 30% 30%, ${a}, ${b} 70%)` }}
        />
      ) : null}
      {id === "neon-rings" ? (
        <>
          <span className={`${common} avatar-spin`} style={{ background: `conic-gradient(${a}, transparent 40%, ${b}, transparent 90%)` }} />
          <span className={`${common} avatar-pulse rounded-full`} style={{ boxShadow: `inset 0 0 ${size * 0.25}px ${a}` }} />
        </>
      ) : null}
      {id === "pulse-grid" ? (
        <>
          <span className={common} style={{ background: `linear-gradient(135deg, ${a}33, ${b}55)` }} />
          <span
            className={`${common} avatar-pulse`}
            style={{
              backgroundImage: `linear-gradient(${a}66 1px, transparent 1px), linear-gradient(90deg, ${a}66 1px, transparent 1px)`,
              backgroundSize: `${Math.max(6, size / 6)}px ${Math.max(6, size / 6)}px`,
            }}
          />
        </>
      ) : null}
      {id === "aurora" ? (
        <span className={`${common} avatar-wave`} style={{ background: `linear-gradient(120deg, ${a}, ${b}, ${a})`, backgroundSize: "300% 300%" }} />
      ) : null}
      {id === "comet" ? (
        <>
          <span className={common} style={{ background: `radial-gradient(circle at 70% 70%, ${b}, #0b0b18 80%)` }} />
          <span className={`${common} avatar-spin`} style={{ background: `conic-gradient(transparent 70%, ${a})` }} />
        </>
      ) : null}
      {id === "prism" ? (
        <span className={`${common} avatar-hue`} style={{ background: `linear-gradient(45deg, ${a}, ${b})` }} />
      ) : null}
      <span
        className="relative font-bold tracking-tight text-white drop-shadow"
        style={{ fontSize: Math.max(10, size * 0.34) }}
      >
        {label}
      </span>
    </span>
  );
}
