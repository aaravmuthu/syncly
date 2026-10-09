/** System announcements have no sender but still become read when viewed. */
export function unreadSquadMessageIds(
  messages: readonly { id: string; sender_id: string | null }[],
  me: string,
  readIds: ReadonlySet<string>,
): string[] {
  return messages
    .filter((message) => message.sender_id !== me && !readIds.has(message.id))
    .map((message) => message.id);
}
