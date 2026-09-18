// ====================================================================
// _shared/errors.ts
//
// Every edge function's catch-all handler previously did:
//   return json({ error: (err as Error).message ?? "Internal error" }, 500);
// which returns whatever the underlying error's message happens to be
// straight to the client -- including raw Postgres error text (column
// names, constraint names, "relation ... does not exist", etc.) for any
// exception that wasn't deliberately raised as a user-facing message.
//
// safeErrorMessage() keeps the small set of errors this codebase
// deliberately raises with a stable, descriptive, safe-to-show prefix
// (e.g. this repo's own RAISE EXCEPTION 'not_authenticated' / 'invalid_status_transition: ...'
// style errors from the Postgres functions/triggers), and replaces
// everything else with a generic message. The original error is always
// still logged server-side via console.error by the caller -- this
// function only controls what reaches the HTTP response body.
// ====================================================================

const SAFE_ERROR_PREFIXES = [
  "not_authenticated",
  "not_authorized",
  "not_an_institution_account",
  "already_onboarded",
  "profile_not_found",
  "name_required",
  "contact_email_required",
  "institution_not_found",
  "institution_already_reviewed",
  "institution_not_approved",
  "invalid_decision",
  "invalid_status_transition",
  "application_status_is_final",
  "opportunity_id and passport_id are immutable",
  "Entrepreneurs may only withdraw",
  "rate_limit",
  "already have a Business Passport",
];

export function safeErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const isSafe = SAFE_ERROR_PREFIXES.some((prefix) => message.includes(prefix));
  return isSafe ? message : fallback;
}
