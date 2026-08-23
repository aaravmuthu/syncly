-- =============================================================================
-- Syncly — Row Level Security policies, batch 3 (messaging)
-- =============================================================================
-- Continues from 20260820000200_rls_policies_2.sql (group_members, plans,
-- plan_participants) and 20260820000300_profiles_group_visibility.sql.
-- Does NOT modify any already-applied migration. Covers the "messaging"
-- stage of the onboarding -> group creation -> messaging -> location-sharing
-- flow: group_messages, message_reads, direct_threads, direct_messages,
-- direct_reactions, direct_reads. contact_nicknames is reviewed and
-- explicitly needs no client-facing policy (see note at the end).
--
-- As of this migration, NONE of batches 2-4 have been pushed to the live
-- database yet (confirmed via `supabase migration list --linked` during the
-- git-history investigation earlier this session) — only batch 1 (profiles,
-- location_pings, guardian_alerts, groups) is live.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Helper functions
-- -----------------------------------------------------------------------------

-- is_thread_member — this name/shape was already on the original schema's
-- unreconstructed-function list (called out in 20260820000000's Section 3
-- comment as one of the 5 not rebuilt because nothing in src/ calls it via
-- .rpc()). It's needed now as a direct_messages/direct_reads policy
-- building block. Also worth noting: the 3 non-functional remote migrations
-- found during this session's git investigation reference an
-- app_private.is_thread_member — further confirming this is the original
-- function's real name, just in a schema layout this project isn't adopting
-- here. Best-effort reconstruction; verify logic against original project if
-- possible.
CREATE OR REPLACE FUNCTION public.is_thread_member(_thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.direct_threads dt
    WHERE dt.id = _thread_id
      AND (dt.a_profile_id = public.my_profile_id() OR dt.b_profile_id = public.my_profile_id())
  );
$$;

-- can_see_group_message — new helper (not on the original function list;
-- group_messages visibility was previously only ever checked inline via
-- is_group_member(group_id) directly on that table). message_reads has no
-- group_id column of its own, so its visibility has to route through the
-- parent message the same way plan_participants routes through can_see_plan.
CREATE OR REPLACE FUNCTION public.can_see_group_message(_message_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_messages gm
    WHERE gm.id = _message_id
      AND public.is_group_member(gm.group_id)
  );
$$;


-- =============================================================================
-- group_messages
-- =============================================================================
-- Access model confirmed 2026-08-20 by tracing every group_messages call
-- site in src/ (chat.functions.ts, chat.server.ts, dm.functions.ts,
-- send-circle-message MCP tool, and this app's own rlscheck.server.ts probe):
--   SELECT: is_group_member(group_id). listMessages (chat.functions.ts) runs
--           an unfiltered-by-membership select gated only by
--           .eq("group_id", data.groupId) with no app-level membership
--           check beforehand — RLS is the only thing stopping a non-member
--           from reading a group's chat history.
--   INSERT: sender_id = my_profile_id() AND is_group_member(group_id).
--           sendMessage has the same "no app-level check" shape as
--           listMessages — RLS is load-bearing here too. System messages
--           (ride updates, plan-created events, etc., sender_id IS NULL) are
--           inserted exclusively via supabaseAdmin in chat.server.ts's
--           postSystemEvent, so this policy never needs to accommodate a
--           null sender_id.
--   UPDATE: none. Confirmed by this app's own security self-check
--           (rlscheck.server.ts) explicitly testing that a non-sender's
--           UPDATE on someone else's group_messages row must be blocked —
--           having zero UPDATE policy satisfies that outright (no one, not
--           even the sender, can edit a sent message; there's no "edit
--           message" feature anywhere in src/).
--   DELETE: none. No delete call site exists.

CREATE POLICY group_messages_select_member
  ON public.group_messages FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY group_messages_insert_member
  ON public.group_messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = public.my_profile_id() AND public.is_group_member(group_id));


-- =============================================================================
-- message_reads
-- =============================================================================
-- Access model confirmed 2026-08-20 (chat.functions.ts, dm.functions.ts):
--   SELECT: can_see_group_message(message_id). listMessages reads every
--           reader of a message (to show read receipts to the whole group,
--           not just the caller's own read state) — this is NOT a
--           self-only policy.
--   INSERT: profile_id = my_profile_id() AND can_see_group_message(message_id).
--           markRead upserts with `ignoreDuplicates: true`, which PostgREST
--           translates to `ON CONFLICT DO NOTHING` — never an actual UPDATE
--           — so no UPDATE policy is needed for this call site.
--   UPDATE / DELETE: none. No call site performs either.

CREATE POLICY message_reads_select_visible
  ON public.message_reads FOR SELECT
  TO authenticated
  USING (public.can_see_group_message(message_id));

CREATE POLICY message_reads_insert_own
  ON public.message_reads FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = public.my_profile_id() AND public.can_see_group_message(message_id));


-- =============================================================================
-- direct_threads
-- =============================================================================
-- Access model confirmed 2026-08-20 (dm.functions.ts: openThread, listInbox,
-- getThread, sendDirect):
--   SELECT: a_profile_id = self OR b_profile_id = self. listInbox runs a
--           completely unfiltered select (no .eq() at all) relying entirely
--           on RLS to scope results to the caller's own threads; getThread
--           has no app-level ownership check before reading by id either.
--   INSERT: caller must be one of the two participants, AND — per your
--           explicit call — the other participant must share a group with
--           the caller (shares_group_with_me(), built in
--           20260820000300_profiles_group_visibility.sql). openThread's own
--           doc comment states the intended model ("People I can start a DM
--           with: everyone who shares a circle with me", matching
--           listContacts), but the handler itself never enforces it —
--           without this clause, RLS would let any authenticated user open
--           a thread with literally any other profile in the app, bypassing
--           the circle-based trust boundary this app relies on everywhere
--           else. This is a deliberate hardening beyond what the current
--           code checks, not a literal transcription of it.
--   UPDATE: a_profile_id = self OR b_profile_id = self. sendDirect bumps
--           last_message_at on the thread via the user-scoped client after
--           posting a message.
--   DELETE: none. No call site exists.

CREATE POLICY direct_threads_select_participant
  ON public.direct_threads FOR SELECT
  TO authenticated
  USING (a_profile_id = public.my_profile_id() OR b_profile_id = public.my_profile_id());

CREATE POLICY direct_threads_insert_participant_shared_group
  ON public.direct_threads FOR INSERT
  TO authenticated
  WITH CHECK (
    (a_profile_id = public.my_profile_id() OR b_profile_id = public.my_profile_id())
    AND public.shares_group_with_me(
      CASE WHEN a_profile_id = public.my_profile_id() THEN b_profile_id ELSE a_profile_id END
    )
  );

CREATE POLICY direct_threads_update_participant
  ON public.direct_threads FOR UPDATE
  TO authenticated
  USING (a_profile_id = public.my_profile_id() OR b_profile_id = public.my_profile_id())
  WITH CHECK (a_profile_id = public.my_profile_id() OR b_profile_id = public.my_profile_id());


-- =============================================================================
-- direct_messages
-- =============================================================================
-- Access model confirmed 2026-08-20 (dm.functions.ts: getThread, listInbox,
-- sendDirect):
--   SELECT: is_thread_member(thread_id). getThread has no app-level
--           membership check before reading a thread's full message history
--           by thread_id — RLS-only gate, same shape as group_messages.
--   INSERT: sender_id = my_profile_id() AND is_thread_member(thread_id).
--           Same "no app-level check" shape.
--   UPDATE / DELETE: none. No edit-message or delete-message feature exists
--           anywhere in src/.

CREATE POLICY direct_messages_select_thread_member
  ON public.direct_messages FOR SELECT
  TO authenticated
  USING (public.is_thread_member(thread_id));

CREATE POLICY direct_messages_insert_thread_member
  ON public.direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = public.my_profile_id() AND public.is_thread_member(thread_id));


-- =============================================================================
-- direct_reactions
-- =============================================================================
-- Access model confirmed 2026-08-20 (dm.functions.ts: getThread,
-- toggleReaction):
--   SELECT: caller must be a member of the reacted-to message's thread —
--           there's no thread_id column on this table, so it routes through
--           direct_messages the same way message_reads routes through
--           group_messages.
--   INSERT: profile_id = my_profile_id() AND same thread-membership check
--           (via the message being reacted to).
--   DELETE: profile_id = my_profile_id() — toggleReaction only ever deletes
--           a reaction it just looked up by .eq("profile_id", mine); no
--           call site removes anyone else's reaction.
--   UPDATE: none. Reactions are toggled (insert/delete), never edited in place.

CREATE POLICY direct_reactions_select_thread_member
  ON public.direct_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.direct_messages dm
      WHERE dm.id = message_id
        AND public.is_thread_member(dm.thread_id)
    )
  );

CREATE POLICY direct_reactions_insert_own
  ON public.direct_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = public.my_profile_id()
    AND EXISTS (
      SELECT 1 FROM public.direct_messages dm
      WHERE dm.id = message_id
        AND public.is_thread_member(dm.thread_id)
    )
  );

CREATE POLICY direct_reactions_delete_own
  ON public.direct_reactions FOR DELETE
  TO authenticated
  USING (profile_id = public.my_profile_id());


-- =============================================================================
-- direct_reads
-- =============================================================================
-- Access model confirmed 2026-08-20 (dm.functions.ts: listInbox, getThread,
-- markThreadRead):
--   SELECT: is_thread_member(thread_id) — NOT self-only. getThread reads
--           every participant's read-receipt row for a thread (to compute
--           peerReadAt, the other person's last-read timestamp), not just
--           the caller's own.
--   INSERT + UPDATE: profile_id = my_profile_id(). markThreadRead upserts
--           WITHOUT ignoreDuplicates, so PostgREST generates a real
--           `ON CONFLICT (thread_id, profile_id) DO UPDATE` — unlike
--           message_reads, this table genuinely needs both an INSERT and an
--           UPDATE policy for the same self-only call site. INSERT also
--           checks is_thread_member(thread_id); UPDATE only needs
--           profile_id = self, since a caller can only ever reach their own
--           existing row through the (thread_id, profile_id) conflict target
--           either way.
--   DELETE: none. No call site exists.

CREATE POLICY direct_reads_select_thread_member
  ON public.direct_reads FOR SELECT
  TO authenticated
  USING (public.is_thread_member(thread_id));

CREATE POLICY direct_reads_insert_own
  ON public.direct_reads FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = public.my_profile_id() AND public.is_thread_member(thread_id));

CREATE POLICY direct_reads_update_own
  ON public.direct_reads FOR UPDATE
  TO authenticated
  USING (profile_id = public.my_profile_id())
  WITH CHECK (profile_id = public.my_profile_id());


-- =============================================================================
-- contact_nicknames — reviewed, no policy added
-- =============================================================================
-- All three call sites (friend.server.ts: the nickname read used to build
-- the Friend Profile Sheet, and the two writes behind it) use `db = admin()`
-- (supabaseAdmin/service_role) exclusively — nothing in src/ ever touches
-- this table with the user-scoped client. RLS stays enabled with zero
-- policies (its state since 20260820000000), which is already correct:
-- service_role bypasses RLS regardless, and no client-side access path
-- exists to accidentally lock out. Documenting this explicitly so it reads
-- as "reviewed, intentionally untouched" rather than "forgotten."
