/**
 * Sanitize a post-login `next` redirect target.
 *
 * Returns `next` only if it is a same-origin *relative* path (rooted at a single
 * `/`); anything else falls back to `fallback`. This prevents an open redirect
 * where a crafted `?next=https://evil.com` link would bounce a freshly
 * authenticated user off to a phishing site.
 *
 * Rejected: absolute URLs (`https://…`), protocol-relative URLs (`//evil.com`),
 * the backslash trick (`/\evil.com`, which some browsers normalize to `//`), and
 * anything containing control characters or backslashes (CRLF / normalization
 * tricks). A pure function with no dependencies so it is easy to unit-test.
 */
const UNSAFE_CHARS = /[\x00-\x1f\x7f\\]/;

export function safeNextPath(next: unknown, fallback = "/account"): string {
  if (typeof next !== "string" || next.length === 0) return fallback;
  // Must be rooted at "/", but not "//" (protocol-relative) or "/\" (browsers
  // may normalize the backslash to "/", making it protocol-relative).
  if (next[0] !== "/") return fallback;
  if (next[1] === "/" || next[1] === "\\") return fallback;
  // Reject control chars (incl. CR/LF/TAB), DEL, and any backslash anywhere.
  if (UNSAFE_CHARS.test(next)) return fallback;
  return next;
}
