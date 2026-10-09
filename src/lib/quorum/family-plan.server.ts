/**
 * Server-only Family Plus logic: who has the plan, the free-plan limits it
 * lifts, and starting or canceling it.
 *
 * Plus is per family, not per seat: one guardian's plan covers every teen
 * they're linked to, and every co-guardian of those teens.
 */

import {
  FAMILY_PLUS,
  FREE_LIMITS,
  PLUS_REQUIRED,
  limitsFor,
  type BillingInterval,
  type FamilyLimits,
  type MyFamilyPlan,
} from "./family-plan";
import { dbError } from "@/lib/db-error";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const IN_EFFECT = ["trialing", "active", "canceled"];

/** Which of these profiles have a Plus plan in effect right now. */
async function withPlus(profileIds: string[]): Promise<Set<string>> {
  if (!profileIds.length) return new Set();
  const db = await admin();
  const { data, error } = await db
    .from("family_plans")
    .select("profile_id")
    .in("profile_id", profileIds)
    .in("status", IN_EFFECT)
    .gt("current_period_end", new Date().toISOString());
  // Fall back to the free plan rather than taking the family hub down with it.
  if (error) {
    console.error(`[family-plans] lookup failed, treating as free: ${error.message}`);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.profile_id as string));
}

async function guardiansOf(teenIds: string[]): Promise<string[]> {
  if (!teenIds.length) return [];
  const db = await admin();
  const { data } = await db
    .from("guardian_links")
    .select("guardian_profile_id")
    .in("teen_profile_id", teenIds);
  return [...new Set((data ?? []).map((r) => r.guardian_profile_id as string))];
}

async function teensOf(guardianProfileId: string): Promise<string[]> {
  const db = await admin();
  const { data } = await db
    .from("guardian_links")
    .select("teen_profile_id")
    .eq("guardian_profile_id", guardianProfileId);
  return (data ?? []).map((r) => r.teen_profile_id as string);
}

/** A teen's family has Plus when any of their guardians does. */
export async function teenHasPlus(teenProfileId: string): Promise<boolean> {
  return (await withPlus(await guardiansOf([teenProfileId]))).size > 0;
}

/**
 * The limits a guardian works under: their own plan, or a co-guardian's
 * plan when they share a teen (so a family pays once).
 */
export async function guardianLimits(
  guardianProfileId: string,
): Promise<{ tier: "free" | "plus"; limits: FamilyLimits }> {
  const family = [guardianProfileId, ...(await guardiansOf(await teensOf(guardianProfileId)))];
  const tier = (await withPlus(family)).size > 0 ? "plus" : "free";
  return { tier, limits: limitsFor(tier) };
}

/** Throws a Plus-required error when the teen already has their free safe zones. */
export async function assertCanAddSafeZone(teenProfileId: string) {
  if (await teenHasPlus(teenProfileId)) return;
  const db = await admin();
  const { count } = await db
    .from("safe_zones")
    .select("id", { count: "exact", head: true })
    .eq("teen_profile_id", teenProfileId);
  if ((count ?? 0) >= FREE_LIMITS.safeZonesPerTeen) {
    throw new Error(
      `${PLUS_REQUIRED} The free plan includes ${FREE_LIMITS.safeZonesPerTeen} safe zones per teen. Family Plus makes them unlimited.`,
    );
  }
}

/**
 * Throws a Plus-required error when linking this teen would go past the free
 * plan: a second teen for this guardian, or a second guardian for this teen.
 */
export async function assertCanLinkTeen(guardianProfileId: string, teenProfileId: string) {
  const { tier } = await guardianLimits(guardianProfileId);
  if (tier === "plus") return;

  // Pending requests count too, so two requests can't both be approved.
  const db = await admin();
  const { data: pending } = await db
    .from("guardian_link_requests")
    .select("teen_profile_id")
    .eq("guardian_profile_id", guardianProfileId)
    .gt("expires_at", new Date().toISOString());
  const myTeens = new Set(
    [
      ...(await teensOf(guardianProfileId)),
      ...(pending ?? []).map((r) => r.teen_profile_id),
    ].filter((id) => id !== teenProfileId),
  );
  if (myTeens.size >= FREE_LIMITS.teensPerGuardian) {
    throw new Error(
      `${PLUS_REQUIRED} The free plan covers ${FREE_LIMITS.teensPerGuardian} teen. Family Plus links every teen in your family.`,
    );
  }

  const theirGuardians = (await guardiansOf([teenProfileId])).filter(
    (id) => id !== guardianProfileId,
  );
  if (theirGuardians.length >= FREE_LIMITS.guardiansPerTeen) {
    // A co-guardian's Plus already covers this family.
    if ((await withPlus(theirGuardians)).size > 0) return;
    throw new Error(
      `${PLUS_REQUIRED} This teen already has a parent linked. On the free plan each teen has ${FREE_LIMITS.guardiansPerTeen} parent; Family Plus adds the whole family.`,
    );
  }
}

/** The caller's own plan row, shaped for the client. */
export async function myFamilyPlan(profileId: string): Promise<MyFamilyPlan> {
  const [own, family] = await Promise.all([ownPlan(profileId), guardianLimits(profileId)]);
  return { ...own, familyTier: family.tier };
}

async function ownPlan(profileId: string): Promise<Omit<MyFamilyPlan, "familyTier">> {
  const db = await admin();
  const { data, error } = await db
    .from("family_plans")
    .select("status, billing_interval, current_period_end, trial_used_at")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw dbError(error, "myFamilyPlan");
  const inEffect =
    data != null &&
    IN_EFFECT.includes(data.status) &&
    new Date(data.current_period_end).getTime() > Date.now();
  return {
    tier: inEffect ? "plus" : "free",
    status: inEffect ? (data.status as MyFamilyPlan["status"]) : "free",
    interval: inEffect ? (data.billing_interval as BillingInterval) : null,
    periodEnd: inEffect ? data.current_period_end : null,
    trialAvailable: !data?.trial_used_at,
  };
}

/**
 * Starts the founding-family trial, or resumes a canceled plan that hasn't
 * ended yet. No payment is taken: billing isn't connected.
 */
export async function startFamilyPlus(profileId: string, interval: BillingInterval) {
  const db = await admin();
  const current = await ownPlan(profileId);
  const now = new Date();

  if (current.tier === "plus") {
    const { error } = await db
      .from("family_plans")
      .update({
        status: current.status === "canceled" ? "trialing" : current.status,
        billing_interval: interval,
        canceled_at: null,
        updated_at: now.toISOString(),
      })
      .eq("profile_id", profileId);
    if (error) throw dbError(error, "startFamilyPlus");
    return myFamilyPlan(profileId);
  }

  if (!current.trialAvailable) {
    throw new Error(
      "Your founding trial has ended. Paid Family Plus is opening soon. We'll let you know.",
    );
  }

  const end = new Date(now);
  end.setMonth(end.getMonth() + FAMILY_PLUS.foundingTrialMonths);
  const { error } = await db.from("family_plans").upsert(
    {
      profile_id: profileId,
      status: "trialing",
      billing_interval: interval,
      source: "founding",
      current_period_end: end.toISOString(),
      trial_used_at: now.toISOString(),
      canceled_at: null,
      updated_at: now.toISOString(),
    },
    { onConflict: "profile_id" },
  );
  if (error) throw dbError(error, "startFamilyPlus");
  return myFamilyPlan(profileId);
}

/** Cancels at period end: Plus stays on until then, matching how billing will work. */
export async function cancelFamilyPlus(profileId: string) {
  const db = await admin();
  const now = new Date().toISOString();
  const { error } = await db
    .from("family_plans")
    .update({ status: "canceled", canceled_at: now, updated_at: now })
    .eq("profile_id", profileId)
    .in("status", ["trialing", "active"]);
  if (error) throw dbError(error, "cancelFamilyPlus");
  return myFamilyPlan(profileId);
}
