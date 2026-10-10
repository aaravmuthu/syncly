import type { ReactNode } from "react";
import { toast as sonner, type ExternalToast } from "sonner";
import { showInlineError } from "./inline-error";

type ErrorData = Pick<ExternalToast, "description"> & {
  action?: { label: ReactNode; onClick: () => void };
};

/**
 * Sonner, except errors and "not available" notices never pop up: they land
 * on the button that was pressed (see inline-error.ts). Only an error with no
 * control behind it falls back to a plain, uncolored toast.
 */
function error(message: ReactNode, data?: ErrorData) {
  const description =
    typeof data?.description === "function" ? data.description() : data?.description;
  const id = showInlineError(message, { description, action: data?.action });
  return id === false ? sonner(message, data) : id;
}

export const toast: typeof sonner = Object.assign(
  ((message, data) => sonner(message, data)) as typeof sonner,
  sonner,
  { error, warning: error },
);
