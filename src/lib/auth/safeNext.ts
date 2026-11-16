// Validates a post-auth `next` destination taken from a query string.
//
// A prefix check ("starts with / but not //") is not enough: URL parsers
// treat "\" as "/" and silently strip tabs/newlines, so "/\evil.com" and
// "/\t/evil.com" both resolve to https://evil.com/. Instead the value is
// resolved the same way a browser would, against a placeholder origin,
// and accepted only if it stays on that origin. The returned path is
// rebuilt from the parsed URL, never the raw input.
//
// Shared by the login page (client) and /auth/callback (server), so it
// must stay free of server-only imports.
const PLACEHOLDER_ORIGIN = "http://sithelo.invalid";

export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/")) return null;
  try {
    const url = new URL(next, PLACEHOLDER_ORIGIN);
    if (url.origin !== PLACEHOLDER_ORIGIN) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
