import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, signJwt, verifyJwt } from "@/lib/auth";

describe("password hashing", () => {
  it("verifies a correct password", () => {
    const stored = hashPassword("hunter2");
    expect(verifyPassword("hunter2", stored)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const stored = hashPassword("hunter2");
    expect(verifyPassword("nope", stored)).toBe(false);
  });

  it("uses a per-user salt (same password → different stored hashes)", () => {
    expect(hashPassword("hunter2")).not.toBe(hashPassword("hunter2"));
  });

  it("rejects malformed/legacy stored hashes without throwing", () => {
    expect(verifyPassword("x", "not-a-valid-hash")).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "onlysalt:")).toBe(false);
  });
});

describe("verifyJwt", () => {
  it("round-trips a signed token", () => {
    const token = signJwt({ sub: "u1", email: "a@b.co", jti: "j1" });
    const payload = verifyJwt(token);
    expect(payload?.sub).toBe("u1");
    expect(payload?.email).toBe("a@b.co");
    expect(payload?.jti).toBe("j1");
  });

  it("returns null for malformed tokens without throwing", () => {
    const bad = [
      "",
      "garbage",
      "a.b",
      "a.b.c",
      "a.b.c.d",
      "eyJhIjoxfQ.bm90anNvbg.sig", // valid-ish parts, wrong signature length
    ];
    for (const t of bad) {
      expect(verifyJwt(t)).toBeNull();
    }
  });

  it("returns null for a tampered signature", () => {
    const token = signJwt({ sub: "u1", email: "a@b.co", jti: "j1" });
    const tampered =
      token.slice(0, -2) + (token.slice(-2) === "aa" ? "bb" : "aa");
    expect(verifyJwt(tampered)).toBeNull();
  });

  it("returns null for an expired token", () => {
    const token = signJwt({ sub: "u1", email: "a@b.co", jti: "j1" }, -10);
    expect(verifyJwt(token)).toBeNull();
  });
});
