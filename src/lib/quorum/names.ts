/** Default display_name for anyone who hasn't finished setup — a placeholder, not a name. */
export const UNNAMED = "New member";

/** First name for inline copy ("2 mi for Aarav"); never slices the placeholder into "New". */
export function firstName(name: string): string {
  return name === UNNAMED ? "an unnamed member" : name.split(" ")[0];
}

/** The display name if the person actually set one, else null so callers fall back to their own wording. */
export function realName(name: string | null | undefined): string | null {
  const n = name?.trim();
  return n && n !== UNNAMED ? n : null;
}
