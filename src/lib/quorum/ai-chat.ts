export const AI_QUESTION_LIMIT = 2000;
export const AI_HISTORY_LIMIT = 8;
export type ChatTurn = { role: "user" | "assistant"; content: string };
/** Strip client-only action data and send only the recent conversation. */
export function recentAiHistory(turns: ChatTurn[]): ChatTurn[] {
  return turns
    .slice(-AI_HISTORY_LIMIT)
    .map(({ role, content }) => ({ role, content: content.slice(0, 4000) }));
}
