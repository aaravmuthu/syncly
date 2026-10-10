import type { SupabaseClient } from "@supabase/supabase-js";

/** All current uploads live under auth user ID in these three folders. */
export async function removeAccountUploads(db: SupabaseClient, userId: string) {
  const bucket = db.storage.from("avatars");
  const paths: string[] = [];
  for (const suffix of ["", "/chat", "/voice"]) {
    const folder = `${userId}${suffix}`;
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await bucket.list(folder, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error)
        throw new Error("Could not read your uploaded files for deletion. Please try again.");
      for (const file of data ?? []) {
        if (file.id) paths.push(`${folder}/${file.name}`);
      }
      if (!data || data.length < 100) break;
    }
  }
  // Collect before deleting so offset pagination does not skip shifted rows.
  for (let offset = 0; offset < paths.length; offset += 100) {
    const { error } = await bucket.remove(paths.slice(offset, offset + 100));
    if (error)
      throw new Error(
        "Could not remove your uploaded files. Please retry account deletion or contact support.",
      );
  }
}
