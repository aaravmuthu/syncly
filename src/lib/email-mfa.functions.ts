import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseSession } from "@/integrations/supabase/auth-middleware";

const purpose = z.enum(["enroll", "verify", "disable"]);
export const getEmailSecurity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseSession])
  .handler(async ({ context }) => {
    const { emailSecurityStatus } = await import("./email-mfa.server");
    return emailSecurityStatus(context);
  });
export const sendEmailSecondFactor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseSession])
  .inputValidator(z.object({ purpose }))
  .handler(async ({ context, data }) => {
    const { sendEmailChallenge } = await import("./email-mfa.server");
    return sendEmailChallenge(context, data.purpose);
  });
export const verifyEmailSecondFactor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseSession])
  .inputValidator(
    z.object({ challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/), purpose }),
  )
  .handler(async ({ context, data }) => {
    const { verifyEmailChallenge } = await import("./email-mfa.server");
    return verifyEmailChallenge(context, data);
  });
