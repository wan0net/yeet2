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

export interface GitHubIssueListItem {
  number: number;
  nodeId: string;
  title: string;
  body: string;
  state: "open" | "closed";
  htmlUrl: string;
  labels: string[];
  updatedAt: string | null;
  closedAt: string | null;
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
  mergedAt: string | null;
  state: "open" | "closed";
  headBranch: string;
  baseBranch: string;
}

export class GitHubBranchError extends Error {
  constructor(
    public readonly code: "missing_token" | "invalid_repository_url" | "branch_delete_failed",
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "GitHubBranchError";
  }
}

export class GitHubIssueError extends Error {
  constructor(
    public readonly code: "missing_token" | "invalid_repository_url" | "issue_create_failed" | "issue_list_failed",
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

/**
 * Hosts allowed to receive the GitHub PAT in API calls. Defaults to public
 * GitHub only. Operators using GitHub Enterprise can extend this via env:
 *
 *   YEET2_GITHUB_ALLOWED_HOSTS=github.example.com,git.corp.internal
 *
 * Without an explicit allowlist, registering a project with a non-GitHub
 * host would otherwise route the operator's PAT to the attacker's server
 * via the apiBaseUrlForHost call below.
 */
function allowedGitHubHosts(): Set<string> {
  const hosts = new Set<string>(["github.com", "www.github.com", "api.github.com"]);
  const extra = (process.env.YEET2_GITHUB_ALLOWED_HOSTS ?? "").trim();
  if (extra) {
    for (const host of extra.split(",")) {
      const trimmed = host.trim().toLowerCase();
      if (trimmed) hosts.add(trimmed);
    }
  }
  return hosts;
}

function isAllowedGitHubHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return allowedGitHubHosts().has(normalized);
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
    if (!isAllowedGitHubHost(host)) {
      // Refuse to identify a repo as "GitHub" — and therefore refuse to send
      // the GitHub PAT to that host — unless it's on the allowlist. The
      // project can still be cloned via cloneRepository (subject to that
      // function's separate scheme allowlist), but no API calls will be made.
      return null;
    }
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
    if (!isAllowedGitHubHost(url.hostname)) {
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
    ("merged_at" in candidate && candidate.merged_at !== null && typeof candidate.merged_at !== "string") ||
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
    mergedAt: typeof candidate.merged_at === "string" ? candidate.merged_at : null,
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

export async function deleteGitHubBranchRef(input: {
  token: string | undefined;
  repository: GitHubRepositoryRef;
  branchName: string;
}): Promise<void> {
  if (!input.token) {
    throw new GitHubBranchError("missing_token", "GITHUB_TOKEN is required to delete GitHub branches.", 503);
  }

  const response = await fetch(
    `${input.repository.apiBaseUrl}/repos/${input.repository.owner}/${input.repository.repo}/git/refs/heads/${encodeURIComponent(input.branchName)}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${input.token}`,
        "User-Agent": "yeet2",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  );

  if (response.status === 204 || response.status === 404) {
    return;
  }

  const rawText = await response.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new GitHubBranchError("branch_delete_failed", `GitHub returned invalid JSON (${response.status}).`, 502);
    }
  }

  const message = typeof parsed === "object" && parsed !== null && "message" in parsed ? String((parsed as Record<string, unknown>).message) : response.statusText;
  throw new GitHubBranchError("branch_delete_failed", message || "Unable to delete GitHub branch.", 502);
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

export async function listGitHubIssues(input: {
  token: string | undefined;
  repository: GitHubRepositoryRef;
  state?: "open" | "closed" | "all";
}): Promise<GitHubIssueListItem[]> {
  if (!input.token) {
    throw new GitHubIssueError("missing_token", "GITHUB_TOKEN is required to list GitHub issues.", 503);
  }

  const url = new URL(`${input.repository.apiBaseUrl}/repos/${input.repository.owner}/${input.repository.repo}/issues`);
  url.searchParams.set("state", input.state ?? "all");
  url.searchParams.set("per_page", "100");
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");

  const response = await fetch(url, {
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
      throw new GitHubIssueError("issue_list_failed", `GitHub returned invalid JSON (${response.status}).`, 502);
    }
  }

  if (!response.ok) {
    const message = typeof parsed === "object" && parsed !== null && "message" in parsed ? String((parsed as Record<string, unknown>).message) : response.statusText;
    throw new GitHubIssueError("issue_list_failed", message || "Unable to list GitHub issues.", 502);
  }

  if (!Array.isArray(parsed)) {
    throw new GitHubIssueError("issue_list_failed", "GitHub returned an invalid issue list payload.", 502);
  }

  return parsed.flatMap((candidate) => {
    if (typeof candidate !== "object" || candidate === null) return [];
    const issue = candidate as Record<string, unknown>;
    if (typeof issue.pull_request === "object" && issue.pull_request !== null) return [];
    if (
      typeof issue.number !== "number" ||
      typeof issue.node_id !== "string" ||
      typeof issue.title !== "string" ||
      typeof issue.html_url !== "string" ||
      (issue.state !== "open" && issue.state !== "closed")
    ) {
      return [];
    }

    const labels = Array.isArray(issue.labels)
      ? issue.labels.flatMap((label) => {
          if (typeof label === "string") return [label];
          if (typeof label === "object" && label !== null && typeof (label as Record<string, unknown>).name === "string") {
            return [(label as Record<string, unknown>).name as string];
          }
          return [];
        })
      : [];

    return [
      {
        number: issue.number,
        nodeId: issue.node_id,
        title: issue.title,
        body: typeof issue.body === "string" ? issue.body : "",
        state: issue.state,
        htmlUrl: issue.html_url,
        labels,
        updatedAt: typeof issue.updated_at === "string" ? issue.updated_at : null,
        closedAt: typeof issue.closed_at === "string" ? issue.closed_at : null
      }
    ];
  });
}

export async function commentOnGitHubIssue(input: {
  token: string;
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
}): Promise<void> {
  const response = await fetch(`https://api.github.com/repos/${input.owner}/${input.repo}/issues/${input.issueNumber}/comments`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
      "User-Agent": "yeet2",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify({ body: input.body })
  });

  if (!response.ok) {
    const rawText = await response.text();
    let parsed: unknown = null;
    if (rawText) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new Error(`GitHub returned invalid JSON when commenting on issue (${response.status}).`);
      }
    }
    const message = typeof parsed === "object" && parsed !== null && "message" in parsed ? String((parsed as Record<string, unknown>).message) : response.statusText;
    throw new Error(message || `Unable to comment on GitHub issue #${input.issueNumber}.`);
  }
}

export async function closeGitHubIssue(input: {
  token: string;
  owner: string;
  repo: string;
  issueNumber: number;
}): Promise<void> {
  const response = await fetch(`https://api.github.com/repos/${input.owner}/${input.repo}/issues/${input.issueNumber}`, {
    method: "PATCH",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
      "User-Agent": "yeet2",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify({ state: "closed" })
  });

  if (!response.ok) {
    const rawText = await response.text();
    let parsed: unknown = null;
    if (rawText) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new Error(`GitHub returned invalid JSON when closing issue (${response.status}).`);
      }
    }
    const message = typeof parsed === "object" && parsed !== null && "message" in parsed ? String((parsed as Record<string, unknown>).message) : response.statusText;
    throw new Error(message || `Unable to close GitHub issue #${input.issueNumber}.`);
  }
}

export async function createGitHubTaskIssue(input: {
  token: string;
  owner: string;
  repo: string;
  title: string;
  body: string;
  labels: string[];
}): Promise<{ number: number; nodeId: string; htmlUrl: string }> {
  const response = await fetch(`https://api.github.com/repos/${input.owner}/${input.repo}/issues`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
      "User-Agent": "yeet2",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify({ title: input.title, body: input.body, labels: input.labels })
  });

  const rawText = await response.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error(`GitHub returned invalid JSON when creating task issue (${response.status}).`);
    }
  }

  if (!response.ok) {
    const message = typeof parsed === "object" && parsed !== null && "message" in parsed ? String((parsed as Record<string, unknown>).message) : response.statusText;
    throw new Error(message || "Unable to create GitHub task issue.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("GitHub returned an empty payload when creating task issue.");
  }

  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate.number !== "number" || typeof candidate.node_id !== "string" || typeof candidate.html_url !== "string") {
    throw new Error("GitHub returned an incomplete payload when creating task issue.");
  }

  return {
    number: candidate.number,
    nodeId: candidate.node_id,
    htmlUrl: candidate.html_url
  };
}

export async function ensureGitHubLabels(input: {
  token: string;
  owner: string;
  repo: string;
  labels: Array<{ name: string; color: string; description?: string }>;
}): Promise<void> {
  for (const label of input.labels) {
    const response = await fetch(`https://api.github.com/repos/${input.owner}/${input.repo}/labels`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
        "User-Agent": "yeet2",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({ name: label.name, color: label.color, description: label.description ?? "" })
    });

    if (response.status === 422) {
      // Label already exists — ignore
      continue;
    }

    if (!response.ok) {
      const rawText = await response.text();
      let parsed: unknown = null;
      if (rawText) {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          throw new Error(`GitHub returned invalid JSON when ensuring label "${label.name}" (${response.status}).`);
        }
      }
      const message = typeof parsed === "object" && parsed !== null && "message" in parsed ? String((parsed as Record<string, unknown>).message) : response.statusText;
      throw new Error(message || `Unable to ensure GitHub label "${label.name}".`);
    }
  }
}

async function graphqlRequest(input: { token: string; query: string; variables: Record<string, unknown> }): Promise<Record<string, unknown>> {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${input.token}`,
      "Content-Type": "application/json",
      "User-Agent": "yeet2"
    },
    body: JSON.stringify({ query: input.query, variables: input.variables })
  });

  const rawText = await response.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error(`GitHub GraphQL returned invalid JSON (${response.status}).`);
    }
  }

  if (!response.ok) {
    const message = typeof parsed === "object" && parsed !== null && "message" in parsed ? String((parsed as Record<string, unknown>).message) : response.statusText;
    throw new Error(message || `GitHub GraphQL request failed (${response.status}).`);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("GitHub GraphQL returned an empty response.");
  }

  const result = parsed as Record<string, unknown>;
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    const firstError = result.errors[0] as Record<string, unknown>;
    const errorMessage = typeof firstError.message === "string" ? firstError.message : "Unknown GraphQL error";
    throw new Error(`GitHub GraphQL error: ${errorMessage}`);
  }

  return result;
}

export async function createGitHubProjectV2(input: {
  token: string;
  ownerId: string;
  title: string;
  columnNames: string[];
}): Promise<{ projectId: string; projectNumber: number; url: string }> {
  // Step 1: Create the project
  const createResult = await graphqlRequest({
    token: input.token,
    query: `
      mutation CreateProject($ownerId: ID!, $title: String!) {
        createProjectV2(input: { ownerId: $ownerId, title: $title }) {
          projectV2 { id number url }
        }
      }
    `,
    variables: { ownerId: input.ownerId, title: input.title }
  });

  const createData = createResult.data as Record<string, unknown>;
  const projectV2 = (createData.createProjectV2 as Record<string, unknown>).projectV2 as Record<string, unknown>;
  const projectId = projectV2.id as string;
  const projectNumber = projectV2.number as number;
  const url = projectV2.url as string;

  // Step 2: Find the Status field
  const fieldsResult = await graphqlRequest({
    token: input.token,
    query: `
      query GetProjectFields($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            fields(first: 20) {
              nodes {
                ... on ProjectV2SingleSelectField {
                  id name options { id name }
                }
              }
            }
          }
        }
      }
    `,
    variables: { projectId }
  });

  const nodeData = (fieldsResult.data as Record<string, unknown>).node as Record<string, unknown>;
  const fields = (nodeData.fields as Record<string, unknown>).nodes as Array<Record<string, unknown>>;
  const statusField = fields.find((f) => f.name === "Status");

  if (statusField) {
    const fieldId = statusField.id as string;
    const existingOptions = (statusField.options as Array<Record<string, unknown>>).map((o) => o.name as string);

    // Step 3: Add missing column options
    const allOptions = [
      ...(statusField.options as Array<Record<string, unknown>>).map((o) => ({ id: o.id as string, name: o.name as string, color: "GRAY", description: "" })),
      ...input.columnNames.filter((name) => !existingOptions.includes(name)).map((name) => ({ name, color: "GRAY", description: "" }))
    ];

    if (allOptions.length > (statusField.options as Array<unknown>).length) {
      await graphqlRequest({
        token: input.token,
        query: `
          mutation UpdateStatusField($projectId: ID!, $fieldId: ID!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
            updateProjectV2Field(input: {
              projectId: $projectId
              fieldId: $fieldId
              singleSelectOptions: $options
            }) {
              projectV2Field { id }
            }
          }
        `,
        variables: { projectId, fieldId, options: allOptions }
      });
    }
  }

  return { projectId, projectNumber, url };
}

export async function addGitHubProjectV2Item(input: {
  token: string;
  projectId: string;
  issueNodeId: string;
}): Promise<{ itemId: string }> {
  const result = await graphqlRequest({
    token: input.token,
    query: `
      mutation AddItem($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
          item { id }
        }
      }
    `,
    variables: { projectId: input.projectId, contentId: input.issueNodeId }
  });

  const data = result.data as Record<string, unknown>;
  const item = (data.addProjectV2ItemById as Record<string, unknown>).item as Record<string, unknown>;
  return { itemId: item.id as string };
}

export async function moveGitHubProjectV2Item(input: {
  token: string;
  projectId: string;
  itemId: string;
  fieldId: string;
  optionId: string;
}): Promise<void> {
  await graphqlRequest({
    token: input.token,
    query: `
      mutation MoveItem($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $fieldId
          value: { singleSelectOptionId: $optionId }
        }) {
          projectV2Item { id }
        }
      }
    `,
    variables: { projectId: input.projectId, itemId: input.itemId, fieldId: input.fieldId, optionId: input.optionId }
  });
}

export async function getGitHubAuthenticatedUserNodeId(input: {
  token: string;
}): Promise<{ nodeId: string; login: string }> {
  const response = await fetch("https://api.github.com/user", {
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
      throw new Error(`GitHub returned invalid JSON when fetching authenticated user (${response.status}).`);
    }
  }

  if (!response.ok) {
    const message = typeof parsed === "object" && parsed !== null && "message" in parsed ? String((parsed as Record<string, unknown>).message) : response.statusText;
    throw new Error(message || "Unable to fetch GitHub authenticated user.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("GitHub returned an empty payload when fetching authenticated user.");
  }

  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate.node_id !== "string" || typeof candidate.login !== "string") {
    throw new Error("GitHub returned an incomplete payload when fetching authenticated user.");
  }

  return { nodeId: candidate.node_id, login: candidate.login };
}
