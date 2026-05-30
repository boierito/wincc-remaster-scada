import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/auth.js";

describe("password hashing", () => {
  it("verifies scrypt password hashes and rejects wrong passwords", () => {
    const hash = hashPassword("engineer");
    expect(verifyPassword("engineer", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });

  it("rejects unsupported password hash formats", () => {
    expect(verifyPassword("engineer", "sha256$legacy")).toBe(false);
  });
});
