import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as v from "./schemas";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dbError, UPLOAD_FAILED } from "@/lib/db-error";

/** Finds (or creates) the 1-on-1 thread between me and another profile. */
export const openThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ peerId: v.id }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    const mine = me as string | null;
    if (!mine) throw new Error("Profile missing");
    if (!data.peerId || data.peerId === mine) throw new Error("Pick someone else");

    const [a, b] = [mine, data.peerId].sort();
    const existing = await supabase
      .from("direct_threads")
      .select("id")
      .eq("a_profile_id", a!)
      .eq("b_profile_id", b!)
      .maybeSingle();
    if (existing.data?.id) return { threadId: existing.data.id as string };

    const { data: row, error } = await supabase
      .from("direct_threads")
      .insert({ a_profile_id: a!, b_profile_id: b! })
      .select("id")
      .single();
    if (error) throw dbError(error, "openThread");
    return { threadId: row.id as string };
  });

/** Inbox: 1-on-1 threads + squad group chats, newest activity first. */
export const listInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    const mine = (me as string | null) ?? null;
    if (!mine) return { me: null, threads: [], squads: [] };

    const { data: threads } = await supabase
      .from("direct_threads")
      .select(
        "id, a_profile_id, b_profile_id, last_message_at, a:a_profile_id(id, display_name, avatar_url, avatar_emoji), b:b_profile_id(id, display_name, avatar_url, avatar_emoji)",
      )
      .order("last_message_at", { ascending: false })
      .limit(60);

    const ids = (threads ?? []).map((t) => t.id as string);
    const { data: msgs } = ids.length
      ? await supabase
          .from("direct_messages")
          .select("id, thread_id, sender_id, content, kind, created_at")
          .in("thread_id", ids)
          .order("created_at", { ascending: false })
          .limit(400)
      : { data: [] as never[] };
    const { data: reads } = ids.length
      ? await supabase
          .from("direct_reads")
          .select("thread_id, last_read_at")
          .eq("profile_id", mine)
          .in("thread_id", ids)
      : { data: [] as never[] };

    const readAt = new Map<string, string>();
    for (const r of reads ?? []) readAt.set(r.thread_id as string, r.last_read_at as string);

    const dm = (threads ?? []).map((t) => {
      const peerRaw = (t.a_profile_id as string) === mine ? t.b : t.a;
      const peer = (Array.isArray(peerRaw) ? peerRaw[0] : peerRaw) as {
        id: string;
        display_name: string;
        avatar_url: string | null;
        avatar_emoji: string | null;
      } | null;
      const mine_msgs = (msgs ?? []).filter((m) => m.thread_id === t.id);
      const last = mine_msgs[0] ?? null;
      const since = readAt.get(t.id as string);
      const unread = mine_msgs.filter(
        (m) =>
          m.sender_id !== mine && (!since || new Date(m.created_at as string) > new Date(since)),
      ).length;
      return {
        id: t.id as string,
        peer,
        last: last
          ? {
              content: (last.content as string) || (last.kind as string),
              kind: last.kind as string,
              at: last.created_at as string,
              mine: last.sender_id === mine,
            }
          : null,
        unread,
        lastAt: (last?.created_at as string) ?? (t.last_message_at as string),
      };
    });

    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id, groups:group_id(id, name, emoji, avatar_url)")
      .eq("profile_id", mine);
    const groupIds = (memberships ?? []).map((m) => m.group_id as string);
    const { data: gmsgs } = groupIds.length
      ? await supabase
          .from("group_messages")
          .select("id, group_id, sender_id, content, created_at")
          .in("group_id", groupIds)
          .order("created_at", { ascending: false })
          .limit(400)
      : { data: [] as never[] };
    const { data: greads } = (gmsgs ?? []).length
      ? await supabase
          .from("message_reads")
          .select("message_id")
          .eq("profile_id", mine)
          .in(
            "message_id",
            (gmsgs ?? []).map((m) => m.id as string),
          )
      : { data: [] as never[] };
    const readIds = new Set((greads ?? []).map((r) => r.message_id as string));

    const squads = (memberships ?? []).map((m) => {
      const g = (Array.isArray(m.groups) ? m.groups[0] : m.groups) as {
        id: string;
        name: string;
        emoji: string | null;
        avatar_url: string | null;
      } | null;
      const rows = (gmsgs ?? []).filter((x) => x.group_id === m.group_id);
      const last = rows[0] ?? null;
      const unread = rows.filter(
        (x) => x.sender_id !== mine && !readIds.has(x.id as string),
      ).length;
      return {
        id: m.group_id as string,
        name: g?.name ?? "Squad",
        emoji: g?.emoji ?? "✨",
        avatar_url: g?.avatar_url ?? null,
        last: last ? { content: last.content as string, at: last.created_at as string } : null,
        unread,
        lastAt: (last?.created_at as string) ?? "",
      };
    });

    dm.sort((x, y) => (y.lastAt ?? "").localeCompare(x.lastAt ?? ""));
    squads.sort((x, y) => (y.lastAt ?? "").localeCompare(x.lastAt ?? ""));
    return { me: mine, threads: dm, squads };
  });

/** Full DM thread: messages, reactions, peer profile and their live telemetry. */
export const getThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ threadId: v.id }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    const mine = me as string | null;
    if (!mine) throw new Error("Profile missing");

    const { data: thread, error } = await supabase
      .from("direct_threads")
      .select(
        "id, a_profile_id, b_profile_id, a:a_profile_id(id, display_name, avatar_url, avatar_emoji), b:b_profile_id(id, display_name, avatar_url, avatar_emoji)",
      )
      .eq("id", data.threadId)
      .maybeSingle();
    if (error) throw dbError(error, "getThread");
    if (!thread) throw new Error("Thread not found");

    const peerRaw = (thread.a_profile_id as string) === mine ? thread.b : thread.a;
    const peer = (Array.isArray(peerRaw) ? peerRaw[0] : peerRaw) as {
      id: string;
      display_name: string;
      avatar_url: string | null;
      avatar_emoji: string | null;
    } | null;

    const { data: messages } = await supabase
      .from("direct_messages")
      .select("*")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true })
      .limit(300);

    const ids = (messages ?? []).map((m) => m.id as string);
    const { data: reactions } = ids.length
      ? await supabase
          .from("direct_reactions")
          .select("message_id, profile_id, emoji")
          .in("message_id", ids)
      : { data: [] as never[] };

    const { data: reads } = await supabase
      .from("direct_reads")
      .select("profile_id, last_read_at")
      .eq("thread_id", data.threadId);
    const peerReadAt = (reads ?? []).find((r) => r.profile_id !== mine)?.last_read_at ?? null;

    let telemetry: {
      lat: number;
      lon: number;
      battery: number | null;
      status: string | null;
      at: string;
    } | null = null;
    if (peer?.id) {
      const { data: ping } = await supabase
        .from("location_pings")
        .select("lat, lon, battery_pct, status_label, created_at")
        .eq("profile_id", peer.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ping) {
        telemetry = {
          lat: ping.lat as number,
          lon: ping.lon as number,
          battery: (ping.battery_pct as number | null) ?? null,
          status: (ping.status_label as string | null) ?? null,
          at: ping.created_at as string,
        };
      }
    }

    return {
      me: mine,
      peer,
      messages: messages ?? [],
      reactions: reactions ?? [],
      peerReadAt,
      telemetry,
    };
  });

export const sendDirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      threadId: v.id,
      content: v.text(4000).optional(),
      // "system" rows are server-generated only; clients can't forge them.
      kind: z.enum(["text", "location", "venue", "voice"]).optional(),
      mediaUrl: v.optHttpsUrl,
      meta: v.messageMeta.optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    const mine = me as string | null;
    if (!mine) throw new Error("Profile missing");
    const body = (data.content ?? "").trim().slice(0, 2000);
    const kind = data.kind ?? "text";
    if (!body && !data.mediaUrl && kind === "text") throw new Error("Message is empty");

    const { data: row, error } = await supabase
      .from("direct_messages")
      .insert({
        thread_id: data.threadId,
        sender_id: mine,
        kind,
        content: body,
        media_url: data.mediaUrl ?? null,
        meta: (data.meta ?? {}) as never,
      })
      .select("id")
      .single();
    if (error) throw dbError(error, "sendDirect");
    await supabase
      .from("direct_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", data.threadId);
    return { id: row.id as string };
  });

export const markThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ threadId: v.id }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) return { ok: true };
    await supabase.from("direct_reads").upsert(
      {
        thread_id: data.threadId,
        profile_id: me as string,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "thread_id,profile_id" },
    );
    return { ok: true };
  });

export const toggleReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ messageId: v.id, emoji: v.emoji.min(1) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    const mine = me as string | null;
    if (!mine) throw new Error("Profile missing");
    const emoji = data.emoji.slice(0, 8);
    const { data: existing } = await supabase
      .from("direct_reactions")
      .select("id")
      .eq("message_id", data.messageId)
      .eq("profile_id", mine)
      .eq("emoji", emoji)
      .maybeSingle();
    if (existing?.id) {
      await supabase
        .from("direct_reactions")
        .delete()
        .eq("id", existing.id as string);
      return { on: false };
    }
    const { error } = await supabase
      .from("direct_reactions")
      .insert({ message_id: data.messageId, profile_id: mine, emoji });
    if (error) throw dbError(error, "toggleReaction");
    return { on: true };
  });

/** People I can start a DM with: everyone who shares a circle with me. */
export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    const mine = me as string | null;
    if (!mine) return [];
    const { data: mineGroups } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("profile_id", mine);
    const groupIds = (mineGroups ?? []).map((g) => g.group_id as string);
    if (groupIds.length === 0) return [];
    const { data: rows } = await supabase
      .from("group_members")
      .select(
        "profile_id, groups:group_id(name), profiles:profile_id(id, display_name, avatar_url, avatar_emoji)",
      )
      .in("group_id", groupIds);
    const seen = new Map<
      string,
      {
        id: string;
        name: string;
        avatar_url: string | null;
        avatar_emoji: string | null;
        circles: string[];
      }
    >();
    for (const r of rows ?? []) {
      const p = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as {
        id: string;
        display_name: string;
        avatar_url: string | null;
        avatar_emoji: string | null;
      } | null;
      const g = (Array.isArray(r.groups) ? r.groups[0] : r.groups) as { name: string } | null;
      if (!p || p.id === mine) continue;
      const cur = seen.get(p.id) ?? {
        id: p.id,
        name: p.display_name,
        avatar_url: p.avatar_url,
        avatar_emoji: p.avatar_emoji,
        circles: [] as string[],
      };
      if (g?.name && !cur.circles.includes(g.name)) cur.circles.push(g.name);
      seen.set(p.id, cur);
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

/** Uploads a recorded voice note and returns a long-lived signed URL. */
export const uploadVoiceNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ dataUrl: v.dataUrl }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const match = /^data:([^;]+);base64,(.+)$/.exec(data.dataUrl);
    if (!match) throw new Error("Unsupported recording");
    const contentType = match[1]!;
    if (!/^audio\//.test(contentType)) throw new Error("Voice notes must be audio");
    const bytes = Buffer.from(match[2]!, "base64");
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Voice note must be under 8 MB");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = contentType.includes("mp4") ? "m4a" : "webm";
    const path = `${userId}/voice/${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("avatars")
      .upload(path, bytes, { contentType, upsert: true });
    if (upErr) throw dbError(upErr, "uploadVoiceNote", UPLOAD_FAILED);
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60 * 24 * 3650);
    if (signErr || !signed)
      throw signErr
        ? dbError(signErr, "uploadVoiceNote")
        : new Error("Could not read the recording back");
    return { url: signed.signedUrl };
  });
