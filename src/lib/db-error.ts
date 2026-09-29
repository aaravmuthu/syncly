/**
 * Supabase / Postgres errors name tables, columns, constraints and policies.
 * Log the real error on the server and hand the caller a plain message to
 * throw, so none of that reaches the browser.
 */

type DbErrorLike = { message: string; code?: string | null };

const FRIENDLY_BY_CODE: Record<string, string> = {
  "23505": "That already exists.",
  "42501": "You don't have permission to do that.",
};

export const UPLOAD_FAILED = "Couldn't upload that file. Use an image or recording under 8 MB.";

/** Usage: `if (error) throw dbError(error, "getPlan");` */
export function dbError(error: DbErrorLike, where: string, message?: string): Error {
  console.error(`[db:${where}]${error.code ? ` ${error.code}` : ""} ${error.message}`);
  return new Error(
    message ??
      (error.code && FRIENDLY_BY_CODE[error.code]) ??
      "Something went wrong. Please try again.",
  );
}
