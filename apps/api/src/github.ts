export interface GitHubRepositoryRef {
  host: string;
  owner: string;
  repo: string;
  apiBaseUrl: string;
  htmlBaseUrl: string;
}

export interface GitHubIssueInput {
  token: string | undefined;
  title: string;
  body: string;
}

export interface GitHubIssueResult {
  number: number;
  htmlUrl: string;
}

export class GitHubIssueError extends Error {
  constructor(
    public readonly code: "missing_token" | "invalid_repository_url" | "issue_create_failed",
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "GitHubIssueError";
  }
}

function cleanRepositoryName(value: string): string {
  return value.replace(/\.git$/i, "").replace(/\/+$/g, "");
}

function apiBaseUrlForHost(host: string): string {
  if (host === "github.com" || host === "www.github.com") {
    return "https://api.github.com";
  }

  return `https://${host}/api/v3`;
}

export function parseGitHubRepositoryUrl(repositoryUrl: string): GitHubRepositoryRef | null {
  const trimmed = repositoryUrl.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("git@")) {
    const match = trimmed.match(/^git@([^:]+):(.+)$/i);
    if (!match) {
      return null;
    }

    const [, host, path] = match;
    const parts = cleanRepositoryName(path).split("/").filter(Boolean);
    if (parts.length < 2) {
      return null;
    }

    const [owner, repo] = parts;
    return {
      host,
      owner,
      repo,
      apiBaseUrl: apiBaseUrlForHost(host),
      htmlBaseUrl: `https://${host}`
    };
  }

  try {
    const url = new URL(trimmed);
    const parts = cleanRepositoryName(url.pathname).split("/").filter(Boolean);
    if (parts.length < 2) {
      return null;
    }

    const [owner, repo] = parts;
    return {
      host: url.host,
      owner,
      repo,
      apiBaseUrl: apiBaseUrlForHost(url.host),
      htmlBaseUrl: `${url.protocol}//${url.host}`
    };
  } catch {
    return null;
  }
}

export function buildGitHubIssueBody(input: {
  project: { id: string; name: string; defaultBranch: string; localPath: string; repoUrl: string };
  mission: { id: string; title: string } | null;
  task: { id: string; title: string; agentRole: string };
  blocker: { id: string; title: string; context: string; options: string[]; recommendation: string | null };
}): string {
  const sections = [
    "# yeet2 blocker escalation",
    "",
    "## Blocker",
    `- Blocker ID: ${input.blocker.id}`,
    `- Title: ${input.blocker.title}`,
    "",
    "## Context",
    input.blocker.context,
    "",
    "## Options",
    ...(input.blocker.options.length > 0 ? input.blocker.options.map((option) => `- ${option}`) : ["- No options were provided."]),
    "",
    "## Recommendation",
    input.blocker.recommendation ?? "No recommendation was provided.",
    "",
    "## yeet2 context",
    `- Project: ${input.project.name} (${input.project.id})`,
    `- Task: ${input.task.title} (${input.task.id})`,
    `- Agent role: ${input.task.agentRole}`,
    `- Default branch: ${input.project.defaultBranch}`,
    `- Local path: ${input.project.localPath}`,
    `- Repository: ${input.project.repoUrl}`
  ];

  if (input.mission) {
    sections.push(`- Mission: ${input.mission.title} (${input.mission.id})`);
  }

  return sections.join("\n");
}

export async function createGitHubIssue(input: GitHubIssueInput & { repository: GitHubRepositoryRef }): Promise<GitHubIssueResult> {
  if (!input.token) {
    throw new GitHubIssueError("missing_token", "GITHUB_TOKEN is required to create GitHub issues.", 503);
  }

  const response = await fetch(`${input.repository.apiBaseUrl}/repos/${input.repository.owner}/${input.repository.repo}/issues`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
      "User-Agent": "yeet2",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify({
      title: input.title,
      body: input.body
    })
  });

  const rawText = await response.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new GitHubIssueError("issue_create_failed", `GitHub returned invalid JSON (${response.status}).`, 502);
    }
  }

  if (!response.ok) {
    const message = typeof parsed === "object" && parsed !== null && "message" in parsed ? String((parsed as Record<string, unknown>).message) : response.statusText;
    throw new GitHubIssueError("issue_create_failed", message || "Unable to create GitHub issue.", 502);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new GitHubIssueError("issue_create_failed", "GitHub returned an empty issue payload.", 502);
  }

  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate.number !== "number" || typeof candidate.html_url !== "string") {
    throw new GitHubIssueError("issue_create_failed", "GitHub returned an incomplete issue payload.", 502);
  }

  return {
    number: candidate.number,
    htmlUrl: candidate.html_url
  };
}
