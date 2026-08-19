import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, myProfileId, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_circles",
  title: "List my circles",
  description: "List the Syncly circles (groups) the signed-in member belongs to, with their invite kind and role.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const me = await myProfileId(supabase);
    const { data, error } = await supabase
      .from("group_members")
      .select("role, groups(id, name, emoji, kind, purpose)")
      .eq("profile_id", me);
    if (error) return errorResult(error.message);
    const circles = (data ?? []).map((row) => {
      const g = row.groups as unknown as {
        id: string;
        name: string;
        emoji: string;
        kind: string;
        purpose: string | null;
      } | null;
      return {
        id: g?.id ?? null,
        name: g?.name ?? "Untitled circle",
        emoji: g?.emoji ?? "👥",
        kind: g?.kind ?? "permanent",
        purpose: g?.purpose ?? null,
        myRole: row.role,
      };
    });
    if (!circles.length) return textResult("You are not in any circles yet.", { circles });
    return textResult(
      circles.map((c) => `${c.emoji} ${c.name} — ${c.kind}, you are ${c.myRole} (id: ${c.id})`).join("\n"),
      { circles },
    );
  },
});
