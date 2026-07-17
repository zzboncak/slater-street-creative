export type SeedCredentials = { email: string; password: string };
// Back-compat alias — admin credentials are just seed credentials.
export type AdminCredentials = SeedCredentials;

// Minimum password length for a provisioned account. Low bar — just enough to
// reject a trivial default like "admin"; the real strength comes from the
// operator's chosen value.
export const MIN_ADMIN_PASSWORD_LENGTH = 12;

/**
 * Shared reader for an env-provisioned account (SSC-36 generalized this from the
 * admin-only reader). Pure, so the validation is unit-tested via the wrappers.
 *
 * Returns `null` when BOTH keys are unset — the caller decides what that means
 * (the seed skips creating the user; the rotation script errors). This is
 * deliberate: there is NO default credential anywhere, so the app can never ship
 * a guessable login. Throws on a partial or too-weak configuration so a half-set
 * env fails loudly instead of silently doing the wrong thing.
 *
 * Email is lowercased + trimmed to match how login/signup normalize it, so the
 * stored value can never cause a case-mismatch lockout. The password is kept
 * verbatim (spaces can be intentional).
 */
function readSeedCredentials(
  env: Record<string, string | undefined>,
  emailKey: string,
  passwordKey: string,
): SeedCredentials | null {
  const email = (env[emailKey] ?? "").trim().toLowerCase();
  const password = env[passwordKey] ?? "";

  if (!email && !password) return null;
  if (!email || !password) {
    throw new Error(
      `Set BOTH ${emailKey} and ${passwordKey} (or neither) — only one is set.`,
    );
  }
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(
      `${passwordKey} must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`,
    );
  }
  return { email, password };
}

/**
 * Admin credentials from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, for provisioning
 * (seed) and rotation (scripts/set-admin-password).
 */
export function readAdminCredentials(
  env: Record<string, string | undefined>,
): AdminCredentials | null {
  return readSeedCredentials(env, "ADMIN_EMAIL", "ADMIN_PASSWORD");
}

/**
 * Fulfillment-user credentials from `FULFILLMENT_EMAIL` / `FULFILLMENT_PASSWORD`
 * (SSC-36), for seeding a test account with the FULFILLMENT role. Same no-default
 * posture as the admin: unset = skip, partial/weak = throw.
 */
export function readFulfillmentCredentials(
  env: Record<string, string | undefined>,
): SeedCredentials | null {
  return readSeedCredentials(env, "FULFILLMENT_EMAIL", "FULFILLMENT_PASSWORD");
}
