import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LEGAL } from "@/lib/legal";
import { resolveMyProfileId } from "./me";

export const acceptTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ accepted: z.literal(true) }))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      app_metadata: {
        terms_accepted_at: new Date().toISOString(),
        terms_version: LEGAL.effectiveDate,
      },
    });
    if (error) throw new Error("Could not save your agreement. Please try again.");
    return { ok: true };
  });

export const exportAccountData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await resolveMyProfileId(context.supabase);
    const { exportOwnedRows, exportPrivateAccountRows } = await import("./account-data.server");
    const records = await exportOwnedRows(context.supabase, profileId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Full profile has protected contact fields; scope the privileged read to the caller.
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", context.userId)
      .single();
    if (error) throw new Error("Could not export your profile. Please try again.");
    const privateRecords = await exportPrivateAccountRows(supabaseAdmin, profileId);
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      records: { ...records, ...privateRecords },
      scope:
        "Your profile and authored or owned records readable by your account. Shared records about other people, uploaded file contents, provider logs and backups are excluded. Contact support for additional data access.",
    };
  });
