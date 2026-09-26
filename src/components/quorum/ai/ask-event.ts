export const ASK_EVENT = "syncly:ask";

/** Opens the Ask Syncly sheet from anywhere in the app shell. */
export function openAskSyncly() {
  window.dispatchEvent(new Event(ASK_EVENT));
}
