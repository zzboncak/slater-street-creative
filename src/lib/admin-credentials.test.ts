import { describe, it, expect } from "vitest";
import { readAdminCredentials } from "./admin-credentials";

describe("readAdminCredentials", () => {
  it("returns null when both are unset (skip — never a default)", () => {
    expect(readAdminCredentials({})).toBeNull();
  });

  it("throws when only one of the pair is set", () => {
    expect(() => readAdminCredentials({ ADMIN_EMAIL: "a@b.com" })).toThrow(
      /BOTH/,
    );
    expect(() =>
      readAdminCredentials({ ADMIN_PASSWORD: "longenoughpw1" }),
    ).toThrow(/BOTH/);
  });

  it("rejects a too-short password", () => {
    expect(() =>
      readAdminCredentials({ ADMIN_EMAIL: "a@b.com", ADMIN_PASSWORD: "short" }),
    ).toThrow(/at least 12/);
  });

  it("normalizes the email (trim + lowercase) so it can't mismatch login", () => {
    expect(
      readAdminCredentials({
        ADMIN_EMAIL: "  Owner@Example.COM ",
        ADMIN_PASSWORD: "a-strong-passphrase",
      }),
    ).toEqual({ email: "owner@example.com", password: "a-strong-passphrase" });
  });

  it("keeps the password verbatim (no trimming — spaces can be intentional)", () => {
    const password = "  spaces are fine  ";
    const creds = readAdminCredentials({
      ADMIN_EMAIL: "a@b.com",
      ADMIN_PASSWORD: password,
    });
    expect(creds?.password).toBe(password);
  });
});
