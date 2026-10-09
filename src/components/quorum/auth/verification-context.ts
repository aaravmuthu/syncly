import { createContext } from "react";

/** Lets a code field inside VerificationFeedback play the acceptance badge and say when it has landed. */
export const VerificationContext = createContext<{ accepted: boolean; settle: () => void } | null>(
  null,
);
