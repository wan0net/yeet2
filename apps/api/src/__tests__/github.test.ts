import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildGitHubCompareUrl,
  buildGitHubIssueBody,
  buildGitHubPullRequestBody,
  buildGitHubRepositoryUrl,
  listGitHubIssues,
  parseGitHubRepositoryUrl,
  type GitHubRepositoryRef
} from "../github.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRef(overrides: Partial<GitHubRepositoryRef> = {}): GitHubRepositoryRef {
  return {
    host: "github.com",
    owner: "acme",
    repo: "rocket",
    apiBaseUrl: "https://api.github.com",
    htmlBaseUrl: "https://github.com",
    ...overrides
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// parseGitHubRepositoryUrl
// ---------------------------------------------------------------------------

describe("parseGitHubRepositoryUrl", () => {
  it("parses a standard https github.com URL", () => {
    const result = parseGitHubRepositoryUrl("https://github.com/acme/rocket");
    expect(result).toMatchObject({ host: "github.com", owner: "acme", repo: "rocket" });
  });

  it("sets apiBaseUrl to https://api.github.com for github.com", () => {
    const result = parseGitHubRepositoryUrl("https://github.com/acme/rocket");
    expect(result?.apiBaseUrl).toBe("https://api.github.com");
  });

  it("sets htmlBaseUrl to https://github.com for github.com", () => {
    const result = parseGitHubRepositoryUrl("https://github.com/acme/rocket");
    expect(result?.htmlBaseUrl).toBe("https://github.com");
  });

  it("strips a trailing .git from https URL", () => {
    const result = parseGitHubRepositoryUrl("https://github.com/acme/rocket.git");
    expect(result).toMatchObject({ owner: "acme", repo: "rocket" });
  });

  it("parses an SSH-style git@ URL", () => {
    const result = parseGitHubRepositoryUrl("git@github.com:acme/rocket.git");
    expect(result).toMatchObject({ host: "github.com", owner: "acme", repo: "rocket" });
  });

  it("parses a GitHub Enterprise https URL when the host is allowlisted", () => {
    process.env.YEET2_GITHUB_ALLOWED_HOSTS = "ghe.example.com";
    try {
      const result = parseGitHubRepositoryUrl("https://ghe.example.com/acme/rocket");
      expect(result).toMatchObject({ host: "ghe.example.com", owner: "acme", repo: "rocket" });
    } finally {
      delete process.env.YEET2_GITHUB_ALLOWED_HOSTS;
    }
  });

  it("uses /api/v3 base URL for allowlisted non-github.com hosts", () => {
    process.env.YEET2_GITHUB_ALLOWED_HOSTS = "ghe.example.com";
    try {
      const result = parseGitHubRepositoryUrl("https://ghe.example.com/acme/rocket");
      expect(result?.apiBaseUrl).toBe("https://ghe.example.com/api/v3");
    } finally {
      delete process.env.YEET2_GITHUB_ALLOWED_HOSTS;
    }
  });

  it("rejects a non-allowlisted GitHub Enterprise host (token-leak guard)", () => {
    delete process.env.YEET2_GITHUB_ALLOWED_HOSTS;
    expect(parseGitHubRepositoryUrl("https://attacker.example.com/acme/rocket")).toBeNull();
  });

  it("rejects a non-allowlisted SSH host (token-leak guard)", () => {
    delete process.env.YEET2_GITHUB_ALLOWED_HOSTS;
    expect(parseGitHubRepositoryUrl("git@attacker.example.com:acme/rocket.git")).toBeNull();
  });

  it("normalises www.github.com htmlBaseUrl to https://github.com", () => {
    const result = parseGitHubRepositoryUrl("https://www.github.com/acme/rocket");
    expect(result?.htmlBaseUrl).toBe("https://github.com");
  });

  it("returns null for an empty string", () => {
    expect(parseGitHubRepositoryUrl("")).toBeNull();
  });

  it("returns null for a whitespace-only string", () => {
    expect(parseGitHubRepositoryUrl("   ")).toBeNull();
  });

  it("returns null for an http (non-https) URL", () => {
    expect(parseGitHubRepositoryUrl("http://github.com/acme/rocket")).toBeNull();
  });

  it("returns null for a localhost URL", () => {
    expect(parseGitHubRepositoryUrl("https://localhost/acme/rocket")).toBeNull();
  });

  it("returns null for a URL with only one path segment", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/acme")).toBeNull();
  });

  it("returns null for a malformed git@ URL", () => {
    expect(parseGitHubRepositoryUrl("git@github.com")).toBeNull();
  });

  it("returns null for a random non-URL string", () => {
    expect(parseGitHubRepositoryUrl("not-a-url")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildGitHubRepositoryUrl
// ---------------------------------------------------------------------------

describe("buildGitHubRepositoryUrl", () => {
  it("builds the canonical URL for a github.com repo", () => {
    expect(buildGitHubRepositoryUrl(makeRef())).toBe("https://github.com/acme/rocket");
  });

  it("builds the URL for a GitHub Enterprise repo", () => {
    const ref = makeRef({ host: "ghe.corp.com", htmlBaseUrl: "https://ghe.corp.com", owner: "team", repo: "proj" });
    expect(buildGitHubRepositoryUrl(ref)).toBe("https://ghe.corp.com/team/proj");
  });

  it("strips a trailing slash from htmlBaseUrl before building", () => {
    const ref = makeRef({ htmlBaseUrl: "https://github.com/" });
    expect(buildGitHubRepositoryUrl(ref)).toBe("https://github.com/acme/rocket");
  });

  it("round-trips with parseGitHubRepositoryUrl", () => {
    const parsed = parseGitHubRepositoryUrl("https://github.com/acme/rocket")!;
    expect(buildGitHubRepositoryUrl(parsed)).toBe("https://github.com/acme/rocket");
  });
});

// ---------------------------------------------------------------------------
// buildGitHubCompareUrl
// ---------------------------------------------------------------------------

describe("buildGitHubCompareUrl", () => {
  it("builds a compare URL with simple branch names", () => {
    const url = buildGitHubCompareUrl({
      repository: makeRef(),
      baseBranch: "main",
      compareBranch: "feature/my-branch"
    });
    expect(url).toBe("https://github.com/acme/rocket/compare/main...feature%2Fmy-branch");
  });

  it("URL-encodes special characters in branch names", () => {
    const url = buildGitHubCompareUrl({
      repository: makeRef(),
      baseBranch: "main",
      compareBranch: "fix/issue #42"
    });
    expect(url).toContain(encodeURIComponent("fix/issue #42"));
  });

  it("includes the repository owner and name in the URL", () => {
    const url = buildGitHubCompareUrl({
      repository: makeRef({ owner: "org", repo: "service" }),
      baseBranch: "main",
      compareBranch: "dev"
    });
    expect(url).toContain("/org/service/compare/");
  });

  it("uses the correct separator between base and compare", () => {
    const url = buildGitHubCompareUrl({
      repository: makeRef(),
      baseBranch: "main",
      compareBranch: "dev"
    });
    expect(url).toMatch(/compare\/main\.\.\.dev$/);
  });

  it("works with identical base and compare branches", () => {
    const url = buildGitHubCompareUrl({
      repository: makeRef(),
      baseBranch: "main",
      compareBranch: "main"
    });
    expect(url).toContain("compare/main...main");
  });
});

// ---------------------------------------------------------------------------
// buildGitHubIssueBody
// ---------------------------------------------------------------------------

describe("buildGitHubIssueBody", () => {
  const baseInput = {
    project: {
      id: "proj-1",
      name: "My Project",
      defaultBranch: "main",
      localPath: "/home/user/project",
      repoUrl: "https://github.com/acme/rocket"
    },
    mission: { id: "mission-1", title: "Ship it" },
    task: { id: "task-1", title: "Write tests", agentRole: "qa" },
    blocker: {
      id: "blocker-1",
      title: "Missing credentials",
      context: "The deploy token was not found.",
      options: ["Rotate the token", "Use a service account"],
      recommendation: "Rotate the token"
    }
  };

  it("includes the yeet2 header", () => {
    expect(buildGitHubIssueBody(baseInput)).toContain("# yeet2 blocker escalation");
  });

  it("includes the blocker title", () => {
    expect(buildGitHubIssueBody(baseInput)).toContain("Missing credentials");
  });

  it("includes each option as a list item", () => {
    const body = buildGitHubIssueBody(baseInput);
    expect(body).toContain("- Rotate the token");
    expect(body).toContain("- Use a service account");
  });

  it("uses a fallback message when options array is empty", () => {
    const body = buildGitHubIssueBody({ ...baseInput, blocker: { ...baseInput.blocker, options: [] } });
    expect(body).toContain("No options were provided.");
  });

  it("includes the mission line when mission is provided", () => {
    const body = buildGitHubIssueBody(baseInput);
    expect(body).toContain("- Mission: Ship it (mission-1)");
  });

  it("omits the mission line when mission is null", () => {
    const body = buildGitHubIssueBody({ ...baseInput, mission: null });
    expect(body).not.toContain("- Mission:");
  });

  it("uses fallback text when recommendation is null", () => {
    const body = buildGitHubIssueBody({ ...baseInput, blocker: { ...baseInput.blocker, recommendation: null } });
    expect(body).toContain("No recommendation was provided.");
  });

  it("includes project context fields", () => {
    const body = buildGitHubIssueBody(baseInput);
    expect(body).toContain("- Project: My Project (proj-1)");
    expect(body).toContain("- Agent role: qa");
    expect(body).toContain("- Local path: /home/user/project");
  });
});

// ---------------------------------------------------------------------------
// buildGitHubPullRequestBody
// ---------------------------------------------------------------------------

describe("buildGitHubPullRequestBody", () => {
  const baseInput = {
    project: {
      id: "proj-1",
      name: "My Project",
      defaultBranch: "main",
      localPath: "/home/user/project",
      repoUrl: "https://github.com/acme/rocket"
    },
    task: { id: "task-1", title: "Implement feature", agentRole: "implementer" },
    job: {
      id: "job-1",
      branchName: "feature/my-feature",
      compareUrl: "https://github.com/acme/rocket/compare/main...feature/my-feature",
      executorType: "claude"
    }
  };

  it("includes the yeet2 pull request header", () => {
    expect(buildGitHubPullRequestBody(baseInput)).toContain("# yeet2 pull request");
  });

  it("includes the compare URL when provided", () => {
    const body = buildGitHubPullRequestBody(baseInput);
    expect(body).toContain("https://github.com/acme/rocket/compare/main...feature/my-feature");
  });

  it("uses 'Not available' when compareUrl is null", () => {
    const body = buildGitHubPullRequestBody({ ...baseInput, job: { ...baseInput.job, compareUrl: null } });
    expect(body).toContain("- Compare URL: Not available");
  });

  it("includes task and agent role", () => {
    const body = buildGitHubPullRequestBody(baseInput);
    expect(body).toContain("- Task: Implement feature (task-1)");
    expect(body).toContain("- Agent role: implementer");
  });

  it("includes project details", () => {
    const body = buildGitHubPullRequestBody(baseInput);
    expect(body).toContain("- Project: My Project (proj-1)");
    expect(body).toContain("- Default branch: main");
    expect(body).toContain("- Local path: /home/user/project");
  });

  it("includes job details", () => {
    const body = buildGitHubPullRequestBody(baseInput);
    expect(body).toContain("- Job: job-1");
    expect(body).toContain("- Executor type: claude");
    expect(body).toContain("- Branch: feature/my-feature");
  });
});

describe("listGitHubIssues", () => {
  it("lists issues and skips pull requests", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify([
          {
            number: 7,
            node_id: "I_kwDO",
            title: "Fix deploy",
            body: "Ship the fix",
            state: "open",
            html_url: "https://github.com/acme/rocket/issues/7",
            updated_at: "2026-05-01T00:00:00Z",
            closed_at: null,
            labels: [{ name: "yeet2:implementer" }, "p1"]
          },
          {
            number: 8,
            node_id: "PR_kwDO",
            title: "A pull request",
            state: "open",
            html_url: "https://github.com/acme/rocket/pull/8",
            pull_request: {}
          }
        ]),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const issues = await listGitHubIssues({ token: "ghp_test", repository: makeRef(), state: "all" });

    const firstFetchCall = fetchMock.mock.calls[0] as unknown[] | undefined;
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(firstFetchCall?.[0])).toContain("/repos/acme/rocket/issues?state=all");
    expect(issues).toEqual([
      {
        number: 7,
        nodeId: "I_kwDO",
        title: "Fix deploy",
        body: "Ship the fix",
        state: "open",
        htmlUrl: "https://github.com/acme/rocket/issues/7",
        labels: ["yeet2:implementer", "p1"],
        updatedAt: "2026-05-01T00:00:00Z",
        closedAt: null
      }
    ]);
  });
});
