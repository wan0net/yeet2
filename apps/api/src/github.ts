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

export interface GitHubPullRequestInput {
  token: string | undefined;
  repository: GitHubRepositoryRef;
  title: string;
  body: string;
  headBranch: string;
  baseBranch: string;
  isDraft?: boolean;
}

export interface GitHubPullRequestResult {
  number: number;
  htmlUrl: string;
  title: string;
}

export interface GitHubPullRequestDetails extends GitHubPullRequestResult {
  draft: boolean;
  merged: boolean;
  state: "open" | "closed";
  headBranch: string;
  baseBranch: string;
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

export class GitHubPullRequestError extends Error {
  constructor(
    public readonly code:
      | "missing_token"
      | "invalid_repository_url"
      | "pull_request_fetch_failed"
      | "pull_request_create_failed"
      | "pull_request_merge_failed"
      | "pull_request_not_ready",
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "GitHubPullRequestError";
  }
}

function cleanRepositoryName(value: string): string {
  return value.replace(/\.git$/i, "").replace(/\/+$/g, "");
}

function parseRepositoryPath(path: string): { owner: string; repo: string } | null {
  const parts = cleanRepositoryName(path).split("/").filter(Boolean);
  if (parts.length !== 2) {
    return null;
  }

  const [owner, repo] = parts;
  if (!owner || !repo || owner === "." || owner === ".." || repo === "." || repo === "..") {
    return null;
  }

  return { owner, repo };
}

function isLocalHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]" || normalized === "::1";
}

function apiBaseUrlForHost(host: string): string {
  if (host === "github.com" || host === "www.github.com") {
    return "https://api.github.com";
  }

  return `https://${host}/api/v3`;
}

function htmlBaseUrlForHost(host: string): string {
  if (host === "www.github.com") {
    return "https://github.com";
  }

  return `https://${host}`;
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
    const parsedPath = parseRepositoryPath(path);
    if (!parsedPath) {
      return null;
    }

    return {
      host,
      owner: parsedPath.owner,
      repo: parsedPath.repo,
      apiBaseUrl: apiBaseUrlForHost(host),
      htmlBaseUrl: htmlBaseUrlForHost(host)
    };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || !url.host || isLocalHost(url.hostname)) {
      return null;
    }

    const parsedPath = parseRepositoryPath(url.pathname);
    if (!parsedPath) {
      return null;
    }

    return {
      host: url.host,
      owner: parsedPath.owner,
      repo: parsedPath.repo,
      apiBaseUrl: apiBaseUrlForHost(url.host),
      htmlBaseUrl: htmlBaseUrlForHost(url.host)
    };
  } catch {
    return null;
  }
}

export function buildGitHubRepositoryUrl(repository: GitHubRepositoryRef): string {
  return `${repository.htmlBaseUrl.replace(/\/+$/g, "")}/${repository.owner}/${repository.repo}`;
}

export function buildGitHubCompareUrl(input: {
  repository: GitHubRepositoryRef;
  baseBranch: string;
  compareBranch: string;
}): string {
  const repositoryUrl = buildGitHubRepositoryUrl(input.repository);
  return `${repositoryUrl}/compare/${encodeURIComponent(input.baseBranch)}...${encodeURIComponent(input.compareBranch)}`;
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

export function buildGitHubPullRequestBody(input: {
  project: { id: string; name: string; defaultBranch: string; localPath: string; repoUrl: string };
  task: { id: string; title: string; agentRole: string };
  job: { id: string; branchName: string; compareUrl: string | null; executorType: string };
}): string {
  const compareUrl = input.job.compareUrl ?? "Not available";
  return [
    "# yeet2 pull request",
    "",
    "## Project",
    `- Project: ${input.project.name} (${input.project.id})`,
    `- Default branch: ${input.project.defaultBranch}`,
    `- Local path: ${input.project.localPath}`,
    `- Repository: ${input.project.repoUrl}`,
    "",
    "## Task",
    `- Task: ${input.task.title} (${input.task.id})`,
    `- Agent role: ${input.task.agentRole}`,
    "",
    "## Job",
    `- Job: ${input.job.id}`,
    `- Executor type: ${input.job.executorType}`,
    `- Branch: ${input.job.branchName}`,
    `- Compare URL: ${compareUrl}`
  ].join("\n");
}

export async function createGitHubPullRequest(input: GitHubPullRequestInput): Promise<GitHubPullRequestResult> {
  if (!input.token) {
    throw new GitHubPullRequestError("missing_token", "GITHUB_TOKEN is required to create GitHub pull requests.", 503);
  }

  const response = await fetch(`${input.repository.apiBaseUrl}/repos/${input.repository.owner}/${input.repository.repo}/pulls`, {
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
      body: input.body,
      head: input.headBranch,
      base: input.baseBranch,
      draft: input.isDraft ?? false,
      maintainer_can_modify: true
    })
  });

  const rawText = await response.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new GitHubPullRequestError("pull_request_create_failed", `GitHub returned invalid JSON (${response.status}).`, 502);
    }
  }

  if (!response.ok) {
    const message = typeof parsed === "object" && parsed !== null && "message" in parsed ? String((parsed as Record<string, unknown>).message) : response.statusText;
    throw new GitHubPullRequestError("pull_request_create_failed", message || "Unable to create GitHub pull request.", 502);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new GitHubPullRequestError("pull_request_create_failed", "GitHub returned an empty pull request payload.", 502);
  }

  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate.number !== "number" || typeof candidate.html_url !== "string" || typeof candidate.title !== "string") {
    throw new GitHubPullRequestError("pull_request_create_failed", "GitHub returned an incomplete pull request payload.", 502);
  }

  return {
    number: candidate.number,
    htmlUrl: candidate.html_url,
    title: candidate.title
  };
}

export async function fetchGitHubPullRequest(input: {
  token: string | undefined;
  repository: GitHubRepositoryRef;
  pullRequestNumber: number;
}): Promise<GitHubPullRequestDetails> {
  if (!input.token) {
    throw new GitHubPullRequestError("missing_token", "GITHUB_TOKEN is required to inspect GitHub pull requests.", 503);
  }

  const response = await fetch(`${input.repository.apiBaseUrl}/repos/${input.repository.owner}/${input.repository.repo}/pulls/${input.pullRequestNumber}`, {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${input.token}`,
      "User-Agent": "yeet2",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  const rawText = await response.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new GitHubPullRequestError("pull_request_fetch_failed", `GitHub returned invalid JSON (${response.status}).`, 502);
    }
  }

  if (!response.ok) {
    const message = typeof parsed === "object" && parsed !== null && "message" in parsed ? String((parsed as Record<string, unknown>).message) : response.statusText;
    throw new GitHubPullRequestError("pull_request_fetch_failed", message || "Unable to inspect GitHub pull request.", 502);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new GitHubPullRequestError("pull_request_fetch_failed", "GitHub returned an empty pull request payload.", 502);
  }

  const candidate = parsed as Record<string, unknown>;
  const head = candidate.head as Record<string, unknown> | undefined;
  const base = candidate.base as Record<string, unknown> | undefined;
  if (
    typeof candidate.number !== "number" ||
    typeof candidate.html_url !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.draft !== "boolean" ||
    typeof candidate.merged !== "boolean" ||
    typeof candidate.state !== "string" ||
    !head ||
    typeof head.ref !== "string" ||
    !base ||
    typeof base.ref !== "string"
  ) {
    throw new GitHubPullRequestError("pull_request_fetch_failed", "GitHub returned an incomplete pull request payload.", 502);
  }

  return {
    number: candidate.number,
    htmlUrl: candidate.html_url,
    title: candidate.title,
    draft: candidate.draft,
    merged: candidate.merged,
    state: candidate.state === "closed" ? "closed" : "open",
    headBranch: head.ref,
    baseBranch: base.ref
  };
}

export async function mergeGitHubPullRequest(input: {
  token: string | undefined;
  repository: GitHubRepositoryRef;
  pullRequestNumber: number;
  mergeMethod?: "merge" | "squash" | "rebase";
}): Promise<GitHubPullRequestDetails> {
  if (!input.token) {
    throw new GitHubPullRequestError("missing_token", "GITHUB_TOKEN is required to merge GitHub pull requests.", 503);
  }

  const response = await fetch(`${input.repository.apiBaseUrl}/repos/${input.repository.owner}/${input.repository.repo}/pulls/${input.pullRequestNumber}/merge`, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
      "User-Agent": "yeet2",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify({
      merge_method: input.mergeMethod ?? "squash"
    })
  });

  const rawText = await response.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new GitHubPullRequestError("pull_request_merge_failed", `GitHub returned invalid JSON (${response.status}).`, 502);
    }
  }

  if (!response.ok) {
    const message = typeof parsed === "object" && parsed !== null && "message" in parsed ? String((parsed as Record<string, unknown>).message) : response.statusText;
    throw new GitHubPullRequestError("pull_request_merge_failed", message || "Unable to merge GitHub pull request.", 502);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new GitHubPullRequestError("pull_request_merge_failed", "GitHub returned an empty merge payload.", 502);
  }

  return fetchGitHubPullRequest({
    token: input.token,
    repository: input.repository,
    pullRequestNumber: input.pullRequestNumber
  });
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
