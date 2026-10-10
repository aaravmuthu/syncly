import type { ReactNode } from "react";
import type { ExternalToast } from "sonner";
import { clearInlineError, showInlineFeedback, type InlineError } from "./inline-error";

type FeedbackData = Pick<ExternalToast, "description" | "icon" | "id"> & {
  action?: { label: ReactNode; onClick: () => void };
};

function feedback(tone: InlineError["tone"], message: ReactNode, data?: FeedbackData) {
  const description =
    typeof data?.description === "function" ? data.description() : data?.description;
  return showInlineFeedback(message, { tone, description, action: data?.action });
}

/** One site-wide outcome path. No success/error banners, including fallbacks. */
export const toast = Object.assign(
  (message: ReactNode, data?: FeedbackData) => feedback("info", message, data),
  {
    success: (message: ReactNode, data?: FeedbackData) => feedback("success", message, data),
    error: (message: ReactNode, data?: FeedbackData) => feedback("error", message, data),
    warning: (message: ReactNode, data?: FeedbackData) => feedback("error", message, data),
    info: (message: ReactNode, data?: FeedbackData) => feedback("info", message, data),
    dismiss: (id?: number) => clearInlineError(id),
  },
);
