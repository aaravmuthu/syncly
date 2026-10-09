type Env = Record<string, string | undefined>;

/** Local Vite bridge only; deployed servers continue using runtime bindings. */
export function localSupabaseEnv(file: Env, runtime: Env): Env {
  return {
    SUPABASE_URL:
      runtime.SB_URL ||
      runtime.SUPABASE_URL ||
      file.SB_URL ||
      file.SUPABASE_URL ||
      file.VITE_SB_URL ||
      file.VITE_SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY:
      runtime.SB_PUBLISHABLE_KEY ||
      runtime.SUPABASE_PUBLISHABLE_KEY ||
      file.SB_PUBLISHABLE_KEY ||
      file.SUPABASE_PUBLISHABLE_KEY ||
      file.VITE_SB_PUBLISHABLE_KEY ||
      file.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}
