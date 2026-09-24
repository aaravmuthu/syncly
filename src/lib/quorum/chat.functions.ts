import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as v from "./schemas";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ groupId: v.id, planId: v.optId }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");

    let q = supabase
      .from("group_messages")
      .select(
        "*, profiles:sender_id(id, display_name, avatar_emoji, avatar_url), reply_to:reply_to_id(id, content, sender_id, profiles:sender_id(display_name))",
      )
      .eq("group_id", data.groupId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (data.planId) q = q.eq("plan_id", data.planId);
    const { data: messages, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (messages ?? []).map((m) => m.id);
    const reads = ids.length
      ? (
          await supabase
            .from("message_reads")
            .select("message_id, profile_id, profiles:profile_id(display_name, avatar_emoji, avatar_url)")
            .in("message_id", ids)
        ).data ?? []
      : [];

    const { data: owner } = await supabase
      .from("groups")
      .select("created_by")
      .eq("id", data.groupId)
      .maybeSingle();

    return {
      me: (me as string) ?? null,
      hostId: owner?.created_by ?? null,
      messages: messages ?? [],
      reads,
    };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      groupId: v.id,
      planId: v.optId,
      content: v.text(4000),
      mediaUrl: v.optHttpsUrl,
      replyToId: v.optId,
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const body = (data.content ?? "").trim().slice(0, 2000);
    if (!body && !data.mediaUrl) throw new Error("Message is empty");
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { data: row, error } = await supabase
      .from("group_messages")
      .insert({
        group_id: data.groupId,
        plan_id: data.planId ?? null,
        sender_id: me as string,
        content: body,
        media_url: data.mediaUrl ?? null,
        reply_to_id: data.replyToId ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ messageIds: z.array(v.id).max(500) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const ids = (data.messageIds ?? []).slice(0, 200);
    if (ids.length === 0) return { ok: true };
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) return { ok: true };
    await supabase
      .from("message_reads")
      .upsert(
        ids.map((message_id) => ({ message_id, profile_id: me as string })),
        { onConflict: "message_id,profile_id", ignoreDuplicates: true },
      );
    return { ok: true };
  });

export const uploadChatImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ dataUrl: v.dataUrl, ext: v.text(10).optional() }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const match = /^data:([^;]+);base64,(.+)$/.exec(data.dataUrl);
    if (!match) throw new Error("Unsupported image");
    const contentType = match[1]!;
    if (!/^image\/(png|jpeg|jpg|gif|webp)$/.test(contentType)) {
      throw new Error("Use a PNG, JPG, GIF, or WebP image");
    }
    const bytes = Buffer.from(match[2]!, "base64");
    if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = (data.ext ?? "png").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "png";
    const path = `${userId}/chat/${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("avatars")
      .upload(path, bytes, { contentType, upsert: true });
    if (upErr) throw new Error(upErr.message);
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60 * 24 * 3650);
    if (signErr || !signed) throw new Error(signErr?.message ?? "Could not read image back");
    return { url: signed.signedUrl };
  });

export const postRideUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ groupId: v.id, planId: v.optId, status: v.reqText(120), seats: v.optAmount(50) }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", me as string)
      .maybeSingle();
    const seats =
      typeof data.seats === "number" && data.seats > 0 ? ` — ${data.seats} seats left` : "";
    const { postSystemEvent } = await import("./chat.server");
    await postSystemEvent(data.groupId, data.planId ?? null, {
      type: "ride_update",
      content: `${profile?.display_name ?? "Someone"}: ${data.status}${seats}`,
      meta: { profile_id: me, status: data.status, seats: data.seats ?? null },
    });
    return { ok: true };
  });
