export type AdminCredentials = { email: string; password: string };

// Minimum admin password length. Low bar — just enough to reject a trivial
// default like "admin"; the real strength comes from the operator's chosen value.
export const MIN_ADMIN_PASSWORD_LENGTH = 12;

/**
 * Read admin credentials from the environment (`ADMIN_EMAIL` / `ADMIN_PASSWORD`),
 * for provisioning (seed) and rotation (scripts/set-admin-password). Pure, so the
 * validation is unit-tested.
 *
 * Returns `null` when BOTH are unset — the caller decides what that means (the
 * seed skips admin creation; the rotation script errors). This is deliberate:
 * there is NO default credential anywhere, so the app can never ship a
 * guessable `admin`/`admin`. Throws on a partial or too-weak configuration so a
 * half-set env fails loudly instead of silently doing the wrong thing.
 *
 * Email is lowercased + trimmed to match how login/signup normalize it, so the
 * stored value can never cause a case-mismatch lockout.
 */
export function readAdminCredentials(
  env: Record<string, string | undefined>,
): AdminCredentials | null {
  const email = (env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = env.ADMIN_PASSWORD ?? "";

  if (!email && !password) return null;
  if (!email || !password) {
    throw new Error(
      "Set BOTH ADMIN_EMAIL and ADMIN_PASSWORD (or neither) — only one is set.",
    );
  }
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`,
    );
  }
  return { email, password };
}
