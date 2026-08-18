/** Resolve the caller's profile row id from an authenticated Supabase client. */
export async function resolveMyProfileId(supabase: {
  rpc: (fn: "my_profile_id") => unknown;
}): Promise<string> {
  const { data } = (await supabase.rpc("my_profile_id")) as { data: string | null };
  if (!data) throw new Error("Profile missing");
  return data;
}
