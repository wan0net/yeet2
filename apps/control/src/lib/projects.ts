export type ConstitutionStatus = "missing" | "pending" | "parsed" | "error" | "stale" | "failed" | "unknown";

export interface ConstitutionFileSummary {
  vision: boolean;
  spec: boolean;
  roadmap: boolean;
  architecture: boolean;
  decisions: boolean;
  qualityBar: boolean;
}

export interface ConstitutionSummary {
  repoRoot?: string;
  status: ConstitutionStatus;
  inspectedAt?: string;
  files?: ConstitutionFileSummary;
  presentRequiredFiles?: string[];
  missingRequiredFiles?: string[];
  lastIndexedAt?: string | null;
}

export interface ProjectTaskRecord {
  id: string;
  missionId: string;
  title: string;
  description: string;
  agentRole: string;
  status: string;
  priority: number;
  acceptanceCriteria: string[];
  attempts: number;
  blockerReason: string | null;
  dispatchable?: boolean;
  dispatchBlockedReason?: string | null;
  jobs: ProjectJobRecord[];
}

export interface ProjectJobRecord {
  id: string;
  taskId: string;
  executorType: string;
  workspacePath: string;
  branchName: string;
  status: string;
  logPath: string | null;
  artifactSummary: string | null;
  startedAt: string | null;
  completedAt: string | null;
  githubCompareUrl?: string;
  githubPrNumber: number | null;
  githubPrUrl: string | null;
  githubPrTitle: string | null;
}

export type PlanningProvenance = "crewai" | "brain" | "fallback" | "unknown";

export type ProjectAutonomyMode = "manual" | "supervised" | "autonomous" | "unknown";
export type ProjectPullRequestMode = "manual" | "after_implementer" | "after_reviewer" | "unknown";
export type ProjectPullRequestDraftMode = "draft" | "ready" | "unknown";
export type ProjectMergeApprovalMode = "human_approval" | "agent_signoff" | "no_approval" | "unknown";

export interface ProjectAutonomyState {
  mode: ProjectAutonomyMode;
  pullRequestMode: ProjectPullRequestMode;
  pullRequestDraftMode: ProjectPullRequestDraftMode;
  mergeApprovalMode: ProjectMergeApprovalMode;
  lastRunStatus: string | null;
  lastRunMessage: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export interface ProjectModelCatalogOption {
  value: string;
  label: string;
  description: string | null;
  provider: string | null;
}

export interface ProjectRoleDefinition {
  id: string;
  roleKey: string;
  sortOrder: number;
  label: string;
  enabled: boolean;
  model: string | null;
  goal: string;
  backstory: string;
}

export interface ProjectBlockerRecord {
  id: string;
  taskId: string | null;
  title: string;
  context: string | null;
  options: string[];
  recommendation: string | null;
  status: string;
  githubIssueUrl: string | null;
  createdAt: string | null;
  resolvedAt: string | null;
}

export interface ProjectMissionRecord {
  id: string;
  projectId: string;
  title: string;
  objective: string;
  status: string;
  createdBy: string | null;
  planningProvenance: PlanningProvenance;
  startedAt: string | null;
  completedAt: string | null;
  tasks: ProjectTaskRecord[];
}

export interface ProjectRecord {
  id: string;
  name: string;
  repoUrl: string;
  githubRepoOwner?: string;
  githubRepoName?: string;
  githubRepoUrl?: string;
  defaultBranch: string;
  localPath: string;
  constitutionStatus: ConstitutionStatus;
  constitution: ConstitutionSummary;
  autonomy: ProjectAutonomyState;
  roleDefinitions: ProjectRoleDefinition[];
  missions: ProjectMissionRecord[];
  dispatchableRoles?: string[];
  nextDispatchableTaskId?: string;
  nextDispatchableTaskRole?: string;
  activeMissionCount?: number;
  activeTaskCount?: number;
  blockers: ProjectBlockerRecord[];
  blockerCount?: number;
}

export interface ProjectRegistrationInput {
  name: string;
  repo_url: string;
  default_branch: string;
  local_path?: string;
}

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  webUrl: string;
}

type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  return value as RawRecord;
}

function stringValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return "";
}

function numberValue(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function stringArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeRoleId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizeAutonomyMode(value: unknown): ProjectAutonomyMode {
  const normalized = stringValue(value).toLowerCase();

  switch (normalized) {
    case "manual":
    case "supervised":
    case "autonomous":
      return normalized;
    case "":
      return "unknown";
    default:
      return "unknown";
  }
}

function normalizePullRequestMode(value: unknown): ProjectPullRequestMode {
  const normalized = stringValue(value).toLowerCase();

  switch (normalized) {
    case "manual":
    case "after_implementer":
      return normalized;
    case "after-reviewer":
    case "after_reviewer":
      return "after_reviewer";
    case "":
      return "unknown";
    default:
      return "unknown";
  }
}

function normalizePullRequestDraftMode(value: unknown): ProjectPullRequestDraftMode {
  const normalized = stringValue(value).toLowerCase();

  switch (normalized) {
    case "draft":
    case "ready":
      return normalized;
    case "":
      return "unknown";
    default:
      return "unknown";
  }
}

function normalizeMergeApprovalMode(value: unknown): ProjectMergeApprovalMode {
  const normalized = stringValue(value).toLowerCase();

  switch (normalized) {
    case "human_approval":
    case "agent_signoff":
    case "no_approval":
      return normalized;
    case "human-approval":
      return "human_approval";
    case "agent-signoff":
      return "agent_signoff";
    case "no-approval":
      return "no_approval";
    case "":
      return "unknown";
    default:
      return "unknown";
  }
}

function autonomySource(raw: RawRecord): RawRecord {
  return asRecord(raw.autonomy ?? raw.autonomyState ?? raw.autonomy_state ?? raw.loop ?? raw.loopState ?? raw.loop_state);
}

function normalizeAutonomyState(raw: RawRecord): ProjectAutonomyState {
  const autonomy = autonomySource(raw);
  return {
    mode: normalizeAutonomyMode(
      raw.autonomyMode ??
        raw.autonomy_mode ??
        raw.mode ??
        raw.loopMode ??
        raw.loop_mode ??
        autonomy.mode ??
        autonomy.autonomyMode ??
        autonomy.autonomy_mode
    ),
    pullRequestMode: normalizePullRequestMode(
      raw.pullRequestMode ??
        raw.pull_request_mode ??
        raw.prMode ??
        raw.pr_mode ??
        autonomy.pullRequestMode ??
        autonomy.pull_request_mode ??
        autonomy.prMode ??
        autonomy.pr_mode
    ),
    pullRequestDraftMode: normalizePullRequestDraftMode(
      raw.pullRequestDraftMode ??
        raw.pull_request_draft_mode ??
        raw.prDraftMode ??
        raw.pr_draft_mode ??
        autonomy.pullRequestDraftMode ??
        autonomy.pull_request_draft_mode ??
        autonomy.prDraftMode ??
        autonomy.pr_draft_mode
    ),
    mergeApprovalMode: normalizeMergeApprovalMode(
      raw.mergeApprovalMode ??
        raw.merge_approval_mode ??
        raw.approvalMode ??
        raw.approval_mode ??
        raw.pullRequestApprovalMode ??
        raw.pull_request_approval_mode ??
        autonomy.mergeApprovalMode ??
        autonomy.merge_approval_mode ??
        autonomy.approvalMode ??
        autonomy.approval_mode ??
        autonomy.pullRequestApprovalMode ??
        autonomy.pull_request_approval_mode
    ),
    lastRunStatus: stringValue(
      raw.lastRunStatus,
      raw.last_run_status,
      raw.loopStatus,
      raw.loop_status,
      autonomy.lastRunStatus,
      autonomy.last_run_status
    ) || null,
    lastRunMessage: stringValue(
      raw.lastRunMessage,
      raw.last_run_message,
      raw.loopMessage,
      raw.loop_message,
      autonomy.lastRunMessage,
      autonomy.last_run_message
    ) || null,
    lastRunAt: stringValue(
      raw.lastRunAt,
      raw.last_run_at,
      raw.loopRunAt,
      raw.loop_run_at,
      raw.lastRunTime,
      raw.last_run_time,
      autonomy.lastRunAt,
      autonomy.last_run_at
    ) || null,
    nextRunAt: stringValue(
      raw.nextRunAt,
      raw.next_run_at,
      raw.loopNextRunAt,
      raw.loop_next_run_at,
      raw.nextRunTime,
      raw.next_run_time,
      autonomy.nextRunAt,
      autonomy.next_run_at
    ) || null
  };
}

function formatRoleLabel(value: string): string {
  const parts = value
    .trim()
    .split(/[\s_-]+/g)
    .filter(Boolean);

  if (parts.length === 0) {
    return "Role";
  }

  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function defaultProjectRoleDefinitions(dispatchableRoles: string[] = []): ProjectRoleDefinition[] {
  const enabled = new Set(dispatchableRoles.map((role) => normalizeRoleId(role)));

  return [
    {
      id: "planner",
      roleKey: "planner",
      sortOrder: 0,
      label: "Planner",
      enabled: enabled.has("planner"),
      model: null,
      goal: "Turn the constitution into a crisp planning brief.",
      backstory: "Grounds the team in project intent and the first durable slice."
    },
    {
      id: "architect",
      roleKey: "architect",
      sortOrder: 1,
      label: "Architect",
      enabled: enabled.has("architect"),
      model: null,
      goal: "Refine the plan into concrete structural boundaries.",
      backstory: "Identifies the shape of the system and the dependencies that matter first."
    },
    {
      id: "implementer",
      roleKey: "implementer",
      sortOrder: 2,
      label: "Implementer",
      enabled: enabled.has("implementer") || dispatchableRoles.length === 0,
      model: null,
      goal: "Convert the plan into the smallest shippable implementation slice.",
      backstory: "Focuses on direct, executable steps that move the project forward."
    },
    {
      id: "qa",
      roleKey: "qa",
      sortOrder: 3,
      label: "QA",
      enabled: enabled.has("qa") || dispatchableRoles.length === 0,
      model: null,
      goal: "Add verification and acceptance coverage for the slice.",
      backstory: "Looks for missing checks, edge cases, and review gates."
    },
    {
      id: "reviewer",
      roleKey: "reviewer",
      sortOrder: 4,
      label: "Reviewer",
      enabled: enabled.has("reviewer") || dispatchableRoles.length === 0,
      model: null,
      goal: "Produce an operator-ready review and handoff.",
      backstory: "Checks readability, grounding, and follow-up readiness."
    },
    {
      id: "visual",
      roleKey: "visual",
      sortOrder: 5,
      label: "Visual",
      enabled: enabled.has("visual"),
      model: null,
      goal: "Polish the presentation and any UI-facing details.",
      backstory: "Tunes surfaces and keeps the experience legible."
    }
  ];
}

function normalizeProjectRoleDefinition(value: unknown, fallbackIndex: number): ProjectRoleDefinition | null {
  if (typeof value === "string") {
    const label = value.trim();
    if (!label) {
      return null;
    }

    const id = normalizeRoleId(label);
    return {
      id,
      roleKey: id,
      sortOrder: fallbackIndex,
      label: formatRoleLabel(label),
      enabled: false,
      model: null,
      goal: "",
      backstory: ""
    };
  }

  const raw = asRecord(value);
  const label = stringValue(raw.label, raw.name, raw.title, raw.role, raw.id, raw.key);
  const goal = stringValue(raw.goal, raw.objective, raw.summary);
  const backstory = stringValue(raw.backstory, raw.description, raw.story);

  if (!label && !goal && !backstory) {
    return null;
  }

  const id = normalizeRoleId(stringValue(raw.id, raw.key, raw.role, raw.slug) || label || "role");

  return {
    id,
    roleKey: normalizeRoleId(stringValue(raw.roleKey, raw.role_key, raw.id, raw.key, raw.slug, raw.role) || id),
    sortOrder: numberValue(raw.sortOrder, raw.sort_order, raw.order) ?? fallbackIndex,
    label: label || formatRoleLabel(id),
    enabled: booleanValue(raw.enabled, raw.isEnabled, raw.active, raw.is_active),
    model: stringValue(raw.model, raw.modelName, raw.model_name) || null,
    goal,
    backstory
  };
}

function normalizeProjectRoleDefinitions(raw: RawRecord): ProjectRoleDefinition[] {
  const candidates = Array.isArray(raw.roleDefinitions)
    ? raw.roleDefinitions
    : Array.isArray(raw.role_definitions)
      ? raw.role_definitions
      : Array.isArray(raw.roles)
        ? raw.roles
        : Array.isArray(raw.projectRoles)
          ? raw.projectRoles
          : Array.isArray(raw.project_roles)
            ? raw.project_roles
            : [];

  const normalized = candidates
    .map((entry, index) => normalizeProjectRoleDefinition(entry, index))
    .filter((entry): entry is ProjectRoleDefinition => entry !== null);
  if (normalized.length > 0) {
    return normalized;
  }

  return defaultProjectRoleDefinitions(stringArrayValue(raw.dispatchableRoles ?? raw.dispatchable_roles));
}

function isValidGitHubPathSegment(value: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(value) && value !== "." && value !== "..";
}

function buildGitHubRepoInfo(owner: string, repo: string): GitHubRepoInfo | null {
  if (!isValidGitHubPathSegment(owner) || !isValidGitHubPathSegment(repo)) {
    return null;
  }

  return {
    owner,
    repo,
    webUrl: `https://github.com/${owner}/${repo}`
  };
}

function normalizePlanningProvenanceValue(...values: unknown[]): PlanningProvenance {
  for (const value of values) {
    const normalized = stringValue(value).toLowerCase().replace(/[\s_-]+/g, "");

    if (!normalized) {
      continue;
    }

    if (normalized.includes("crewai")) {
      return "crewai";
    }

    if (normalized.includes("brain")) {
      return "brain";
    }

    if (normalized.includes("fallback")) {
      return "fallback";
    }
  }

  return "unknown";
}

function stripGitSuffix(value: string): string {
  return value.endsWith(".git") ? value.slice(0, -4) : value;
}

export function parseGitHubRepoUrl(value: string): GitHubRepoInfo | null {
  const normalized = value.trim().replace(/\/+$/, "");
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();

    if (parsed.protocol === "https:" && (hostname === "github.com" || hostname === "www.github.com") && !parsed.search && !parsed.hash) {
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.length === 2) {
        const owner = segments[0];
        const repo = stripGitSuffix(segments[1]);
        return buildGitHubRepoInfo(owner, repo);
      }
    }
  } catch {
    // Fall through to SSH-style parsing below.
  }

  const sshMatch = normalized.match(/^(?:ssh:\/\/)?git@github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshMatch) {
    const owner = sshMatch[1];
    const repo = stripGitSuffix(sshMatch[2]);
    return buildGitHubRepoInfo(owner, repo);
  }

  return null;
}

export function githubBranchUrl(repoUrl: string, branchName: string): string | null {
  const repo = parseGitHubRepoUrl(repoUrl);
  const branch = branchName.trim();

  if (!repo || !branch) {
    return null;
  }

  return `${repo.webUrl}/tree/${encodeURIComponent(branch)}`;
}

export function projectGitHubRepoInfo(
  project: Pick<ProjectRecord, "repoUrl" | "githubRepoOwner" | "githubRepoName" | "githubRepoUrl">
): GitHubRepoInfo | null {
  const parsed = parseGitHubRepoUrl(project.repoUrl);
  const parsedGithubRepoUrl = parseGitHubRepoUrl(project.githubRepoUrl ?? "");

  if (parsed) {
    const owner = stringValue(project.githubRepoOwner, parsed.owner);
    const repo = stringValue(project.githubRepoName, parsed.repo);

    return {
      owner: isValidGitHubPathSegment(owner) ? owner : parsed.owner,
      repo: isValidGitHubPathSegment(repo) ? repo : parsed.repo,
      webUrl: parsedGithubRepoUrl?.webUrl ?? parsed.webUrl
    };
  }

  if (parsedGithubRepoUrl) {
    return parsedGithubRepoUrl;
  }

  return null;
}

export function jobGitHubCompareUrl(job: Pick<ProjectJobRecord, "githubCompareUrl">, repoUrl: string, branchName: string): string | null {
  return job.githubCompareUrl ?? githubBranchUrl(repoUrl, branchName);
}

export function jobGitHubPullRequestLabel(job: Pick<ProjectJobRecord, "githubPrNumber" | "githubPrTitle">): string {
  if (job.githubPrNumber != null) {
    return `PR #${job.githubPrNumber}`;
  }

  if (job.githubPrTitle) {
    return job.githubPrTitle;
  }

  return "Pull request";
}

function booleanValue(...values: unknown[]): boolean {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "yes" || normalized === "present" || normalized === "exists") {
        return true;
      }
      if (normalized === "false" || normalized === "no" || normalized === "missing" || normalized === "absent") {
        return false;
      }
      if (normalized.length > 0) {
        return true;
      }
    }

    if (value != null) {
      return true;
    }
  }

  return false;
}

function constitutionSource(raw: RawRecord): RawRecord {
  const candidate = raw.constitution ?? raw.constitutionSummary ?? raw.constitution_summary ?? raw.constitutionSnapshot ?? raw.constitution_snapshot;
  return asRecord(candidate);
}

function fileExists(value: unknown): boolean {
  if (typeof value === "object" && value !== null) {
    const record = asRecord(value);
    return booleanValue(record.exists, record.present, record.available, record.path, record.value);
  }

  return booleanValue(value);
}

export function emptyConstitutionFiles(): ConstitutionFileSummary {
  return {
    vision: false,
    spec: false,
    roadmap: false,
    architecture: false,
    decisions: false,
    qualityBar: false
  };
}

export function normalizeConstitutionStatus(value: unknown): ConstitutionStatus {
  const normalized = stringValue(value).toLowerCase();

  switch (normalized) {
    case "missing":
    case "pending":
    case "parsed":
    case "error":
    case "stale":
    case "failed":
      return normalized;
    case "complete":
      return "parsed";
    case "ready":
      return "pending";
    case "":
      return "unknown";
    default:
      return "unknown";
  }
}

export function normalizeConstitutionFiles(raw: RawRecord): ConstitutionFileSummary {
  const constitution = constitutionSource(raw);
  const snapshot = asRecord(
    constitution.snapshot ?? constitution.files ?? constitution.paths ?? constitution.fileStates ?? raw.constitutionFiles ?? raw.constitution_files
  );

  return {
    vision: fileExists(snapshot.vision ?? constitution.visionPath ?? constitution.vision_path ?? raw.visionPath ?? raw.vision_path),
    spec: fileExists(snapshot.spec ?? constitution.specPath ?? constitution.spec_path ?? raw.specPath ?? raw.spec_path),
    roadmap: fileExists(snapshot.roadmap ?? constitution.roadmapPath ?? constitution.roadmap_path ?? raw.roadmapPath ?? raw.roadmap_path),
    architecture: fileExists(snapshot.architecture ?? constitution.architecturePath ?? constitution.architecture_path ?? raw.architecturePath ?? raw.architecture_path),
    decisions: fileExists(snapshot.decisions ?? constitution.decisionsPath ?? constitution.decisions_path ?? raw.decisionsPath ?? raw.decisions_path),
    qualityBar: fileExists(snapshot.qualityBar ?? snapshot.quality_bar ?? constitution.qualityBarPath ?? constitution.quality_bar_path ?? raw.qualityBarPath ?? raw.quality_bar_path)
  };
}

function normalizeConstitutionSummary(raw: RawRecord): ConstitutionSummary {
  const constitution = constitutionSource(raw);
  return {
    repoRoot: stringValue(raw.repoRoot, raw.repo_root, constitution.repoRoot, constitution.repo_root) || undefined,
    status: normalizeConstitutionStatus(
      raw.constitutionStatus ??
        raw.constitution_status ??
        constitution.parseStatus ??
        constitution.parse_status ??
        constitution.status
    ),
    inspectedAt: stringValue(raw.inspectedAt, raw.inspected_at) || undefined,
    files: normalizeConstitutionFiles(raw),
    presentRequiredFiles: Array.isArray(raw.presentRequiredFiles)
      ? raw.presentRequiredFiles.filter((entry): entry is string => typeof entry === "string")
      : Array.isArray(raw.present_required_files)
        ? raw.present_required_files.filter((entry): entry is string => typeof entry === "string")
        : undefined,
    missingRequiredFiles: Array.isArray(raw.missingRequiredFiles)
      ? raw.missingRequiredFiles.filter((entry): entry is string => typeof entry === "string")
      : Array.isArray(raw.missing_required_files)
        ? raw.missing_required_files.filter((entry): entry is string => typeof entry === "string")
        : undefined,
    lastIndexedAt: stringValue(raw.lastIndexedAt, raw.last_indexed_at) || null
  };
}

function normalizeTaskRecord(value: unknown): ProjectTaskRecord | null {
  const raw = asRecord(value);
  const title = stringValue(raw.title);
  const description = stringValue(raw.description);
  const agentRole = stringValue(raw.agentRole, raw.agent_role);

  if (!title && !description && !agentRole) {
    return null;
  }

  return {
    id: stringValue(raw.id, raw.taskId, raw.task_id) || `${title || "task"}-${Math.random().toString(36).slice(2, 8)}`,
    missionId: stringValue(raw.missionId, raw.mission_id),
    title: title || agentRole || "Task",
    description,
    agentRole: agentRole || "implementer",
    status: stringValue(raw.status) || "ready",
    priority: numberValue(raw.priority) ?? 0,
    acceptanceCriteria: stringArrayValue(raw.acceptanceCriteria ?? raw.acceptance_criteria),
    attempts: numberValue(raw.attempts) ?? 0,
    blockerReason: stringValue(raw.blockerReason, raw.blocker_reason) || null,
    dispatchable:
      typeof raw.dispatchable === "boolean"
        ? raw.dispatchable
        : typeof raw.isDispatchable === "boolean"
          ? raw.isDispatchable
          : typeof raw.is_dispatchable === "boolean"
            ? raw.is_dispatchable
            : undefined,
    dispatchBlockedReason:
      stringValue(raw.dispatchBlockedReason, raw.dispatch_blocked_reason, raw.dispatchReason, raw.dispatch_reason) || null,
    jobs: Array.isArray(raw.jobs) ? raw.jobs.map(normalizeJobRecord).filter((entry): entry is ProjectJobRecord => entry !== null) : []
  };
}

function normalizeJobRecord(value: unknown): ProjectJobRecord | null {
  const raw = asRecord(value);
  const id = stringValue(raw.id, raw.jobId, raw.job_id);
  const workspacePath = stringValue(raw.workspacePath, raw.workspace_path);
  const branchName = stringValue(raw.branchName, raw.branch_name);
  const status = stringValue(raw.status);

  if (!id && !workspacePath && !branchName && !status) {
    return null;
  }

  return {
    id: id || `job-${Math.random().toString(36).slice(2, 8)}`,
    taskId: stringValue(raw.taskId, raw.task_id),
    executorType: stringValue(raw.executorType, raw.executor_type) || "unknown",
    workspacePath,
    branchName,
    status: status || "unknown",
    logPath: stringValue(raw.logPath, raw.log_path) || null,
    artifactSummary: stringValue(raw.artifactSummary, raw.artifact_summary) || null,
    startedAt: stringValue(raw.startedAt, raw.started_at) || null,
    completedAt: stringValue(raw.completedAt, raw.completed_at) || null,
    githubCompareUrl: stringValue(raw.githubCompareUrl, raw.github_compare_url, raw.compareUrl, raw.compare_url) || undefined,
    githubPrNumber: numberValue(raw.githubPrNumber, raw.github_pr_number, raw.pullRequestNumber, raw.pull_request_number) ?? null,
    githubPrUrl: stringValue(raw.githubPrUrl, raw.github_pr_url, raw.pullRequestUrl, raw.pull_request_url) || null,
    githubPrTitle: stringValue(raw.githubPrTitle, raw.github_pr_title, raw.pullRequestTitle, raw.pull_request_title) || null
  };
}

function normalizeBlockerRecord(value: unknown): ProjectBlockerRecord | null {
  const raw = asRecord(value);
  const githubIssue = asRecord(raw.githubIssue ?? raw.github_issue);
  const title = stringValue(raw.title);
  const context = stringValue(raw.context);
  const recommendation = stringValue(raw.recommendation);
  const status = stringValue(raw.status) || "open";
  const taskId = stringValue(raw.taskId, raw.task_id) || null;

  if (!title && !context && !recommendation && !taskId) {
    return null;
  }

  return {
    id: stringValue(raw.id, raw.blockerId, raw.blocker_id) || `blocker-${Math.random().toString(36).slice(2, 8)}`,
    taskId,
    title: title || "Blocker",
    context: context || null,
    options: stringArrayValue(raw.options),
    recommendation: recommendation || null,
    status,
    githubIssueUrl:
      stringValue(
        raw.githubIssueUrl,
        raw.github_issue_url,
        raw.issueUrl,
        raw.issue_url,
        githubIssue.url,
        githubIssue.htmlUrl,
        githubIssue.html_url
      ) || null,
    createdAt: stringValue(raw.createdAt, raw.created_at) || null,
    resolvedAt: stringValue(raw.resolvedAt, raw.resolved_at) || null
  };
}

function normalizeMissionRecord(value: unknown): ProjectMissionRecord | null {
  const raw = asRecord(value);
  const title = stringValue(raw.title);
  const objective = stringValue(raw.objective);
  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks.map(normalizeTaskRecord).filter((entry): entry is ProjectTaskRecord => entry !== null)
    : [];

  if (!title && !objective && tasks.length === 0) {
    return null;
  }

  return {
    id: stringValue(raw.id, raw.missionId, raw.mission_id) || `${title || "mission"}-${Math.random().toString(36).slice(2, 8)}`,
    projectId: stringValue(raw.projectId, raw.project_id),
    title: title || "Mission",
    objective,
    status: stringValue(raw.status) || "active",
    createdBy: stringValue(raw.createdBy, raw.created_by) || null,
    planningProvenance: normalizePlanningProvenanceValue(
      raw.planningProvenance,
      raw.planning_provenance,
      raw.provenance,
      raw.planSource,
      raw.plan_source,
      raw.source,
      raw.createdBy,
      raw.created_by
    ),
    startedAt: stringValue(raw.startedAt, raw.started_at) || null,
    completedAt: stringValue(raw.completedAt, raw.completed_at) || null,
    tasks
  };
}

function normalizeMissions(raw: RawRecord): ProjectMissionRecord[] {
  const candidates = Array.isArray(raw.missions)
    ? raw.missions
    : Array.isArray(raw.mission)
      ? raw.mission
      : raw.mission
        ? [raw.mission]
        : Array.isArray(raw.plan)
          ? raw.plan
          : raw.activeMission ?? raw.active_mission
            ? [raw.activeMission ?? raw.active_mission]
            : [];

  return candidates.map(normalizeMissionRecord).filter((entry): entry is ProjectMissionRecord => entry !== null);
}

function normalizeBlockers(raw: RawRecord): ProjectBlockerRecord[] {
  const candidates = Array.isArray(raw.blockers)
    ? raw.blockers
    : Array.isArray(raw.projectBlockers)
      ? raw.projectBlockers
      : Array.isArray(raw.project_blockers)
        ? raw.project_blockers
        : Array.isArray(raw.openBlockers)
          ? raw.openBlockers
          : Array.isArray(raw.open_blockers)
            ? raw.open_blockers
            : [];

  return candidates.map(normalizeBlockerRecord).filter((entry): entry is ProjectBlockerRecord => entry !== null);
}

export function formatConstitutionFiles(files: ConstitutionFileSummary): string {
  const entries = Object.values(files);
  const present = entries.filter(Boolean).length;
  return `${present}/${entries.length} files present`;
}

export function normalizeProjectRecord(value: unknown, fallbackIndex = 0): ProjectRecord | null {
  const raw = asRecord(value);
  const name = stringValue(raw.name);
  const repoUrl = stringValue(raw.repoUrl, raw.repo_url, raw.repoURL);
  const githubRepoOwner = stringValue(raw.githubRepoOwner, raw.github_repo_owner) || undefined;
  const githubRepoName = stringValue(raw.githubRepoName, raw.github_repo_name) || undefined;
  const githubRepoUrl = stringValue(raw.githubRepoUrl, raw.github_repo_url) || undefined;
  const defaultBranch = stringValue(raw.defaultBranch, raw.default_branch);
  const localPath = stringValue(raw.localPath, raw.local_path);
  const id = stringValue(raw.id, raw.projectId, raw.project_id) || `project-${fallbackIndex}`;
  const missions = normalizeMissions(raw);
  const constitution = normalizeConstitutionSummary(raw);
  const autonomy = normalizeAutonomyState(raw);
  const blockers = normalizeBlockers(raw);

  if (!name && !repoUrl && !localPath) {
    return null;
  }

  return {
    id,
    name: name || repoUrl || id,
    repoUrl,
    githubRepoOwner,
    githubRepoName,
    githubRepoUrl,
    defaultBranch,
    localPath,
    constitutionStatus: normalizeConstitutionStatus(
      raw.constitutionStatus ??
        raw.constitution_status ??
        constitution.status ??
        constitutionSource(raw).parseStatus ??
        constitutionSource(raw).status
    ),
    constitution,
    autonomy,
    roleDefinitions: normalizeProjectRoleDefinitions(raw),
    missions,
    dispatchableRoles: stringArrayValue(raw.dispatchableRoles ?? raw.dispatchable_roles),
    nextDispatchableTaskId: stringValue(raw.nextDispatchableTaskId, raw.next_dispatchable_task_id) || undefined,
    nextDispatchableTaskRole: stringValue(raw.nextDispatchableTaskRole, raw.next_dispatchable_task_role) || undefined,
    activeMissionCount: numberValue(raw.activeMissionCount, raw.active_mission_count, raw.missionCount, raw.mission_count, missions.length) ?? missions.length,
    activeTaskCount:
      numberValue(raw.activeTaskCount, raw.active_task_count, raw.taskCount, raw.task_count) ??
      missions.flatMap((mission) => mission.tasks).filter((task) => task.status !== "complete" && task.status !== "failed" && task.status !== "cancelled").length,
    blockers,
    blockerCount: numberValue(raw.blockerCount, raw.blocker_count) ?? blockers.filter((blocker) => blocker.status === "open").length
  };
}

export function normalizeProjectList(payload: unknown): ProjectRecord[] {
  const raw = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(raw.projects)
      ? raw.projects
      : Array.isArray(raw.items)
        ? raw.items
        : Array.isArray(raw.data)
          ? raw.data
          : null;

  if (list) {
    return list
      .map((entry, index) => normalizeProjectRecord(entry, index))
      .filter((entry): entry is ProjectRecord => entry !== null);
  }

  const single = raw.project ?? raw.item ?? raw.result;
  if (single) {
    const normalized = normalizeProjectRecord(single, 0);
    return normalized ? [normalized] : [];
  }

  return [];
}

export function normalizeProjectRegistration(payload: unknown): ProjectRegistrationInput | null {
  const raw = asRecord(payload);
  const name = stringValue(raw.name);
  const repoUrl = stringValue(raw.repo_url, raw.repoUrl);
  const defaultBranch = stringValue(raw.default_branch, raw.defaultBranch);
  const localPath = stringValue(raw.local_path, raw.localPath);

  if (!name || !repoUrl || !defaultBranch) {
    return null;
  }

  return {
    name,
    repo_url: repoUrl,
    default_branch: defaultBranch,
    ...(localPath ? { local_path: localPath } : {})
  };
}

export function planningProvenanceLabel(value: PlanningProvenance | string | null | undefined): string {
  switch (normalizePlanningProvenanceValue(value)) {
    case "crewai":
      return "CrewAI-backed";
    case "brain":
      return "Brain-generated";
    case "fallback":
      return "Fallback-generated";
    default:
      return "Unknown provenance";
  }
}

export function planningProvenanceTone(value: PlanningProvenance | string | null | undefined): string {
  switch (normalizePlanningProvenanceValue(value)) {
    case "crewai":
      return "border-cyan-200 bg-cyan-50 text-cyan-800";
    case "brain":
      return "border-indigo-200 bg-indigo-50 text-indigo-800";
    case "fallback":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

export function autonomyModeLabel(value: ProjectAutonomyMode | string | null | undefined): string {
  switch (normalizeAutonomyMode(value)) {
    case "manual":
      return "Manual";
    case "supervised":
      return "Supervised";
    case "autonomous":
      return "Autonomous";
    default:
      return "Unknown";
  }
}

export function autonomyModeTone(value: ProjectAutonomyMode | string | null | undefined): string {
  switch (normalizeAutonomyMode(value)) {
    case "manual":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "supervised":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "autonomous":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

export function pullRequestModeLabel(value: ProjectPullRequestMode | string | null | undefined): string {
  switch (normalizePullRequestMode(value)) {
    case "manual":
      return "Manual";
    case "after_implementer":
      return "After implementer";
    case "after_reviewer":
      return "After reviewer";
    default:
      return "Unknown";
  }
}

export function pullRequestModeTone(value: ProjectPullRequestMode | string | null | undefined): string {
  switch (normalizePullRequestMode(value)) {
    case "manual":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "after_implementer":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "after_reviewer":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

export function pullRequestDraftModeLabel(value: ProjectPullRequestDraftMode | string | null | undefined): string {
  switch (normalizePullRequestDraftMode(value)) {
    case "draft":
      return "Draft";
    case "ready":
      return "Ready";
    default:
      return "Unknown";
  }
}

export function pullRequestDraftModeTone(value: ProjectPullRequestDraftMode | string | null | undefined): string {
  switch (normalizePullRequestDraftMode(value)) {
    case "draft":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

export function mergeApprovalModeLabel(value: ProjectMergeApprovalMode | string | null | undefined): string {
  switch (normalizeMergeApprovalMode(value)) {
    case "human_approval":
      return "Human approval";
    case "agent_signoff":
      return "Agent signoff";
    case "no_approval":
      return "No approval";
    default:
      return "Unknown";
  }
}

export function mergeApprovalModeTone(value: ProjectMergeApprovalMode | string | null | undefined): string {
  switch (normalizeMergeApprovalMode(value)) {
    case "human_approval":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "agent_signoff":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "no_approval":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

export function projectRoleModelValues(project: Pick<ProjectRecord, "roleDefinitions">): string[] {
  return [...new Set(project.roleDefinitions.map((definition) => definition.model?.trim() ?? "").filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function normalizeModelCatalogItem(value: unknown): ProjectModelCatalogOption | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    return {
      value: trimmed,
      label: trimmed,
      description: null,
      provider: null
    };
  }

  const raw = asRecord(value);
  const valueId = stringOrNull(raw.value) ?? stringOrNull(raw.id) ?? stringOrNull(raw.model) ?? stringOrNull(raw.name);
  if (!valueId) {
    return null;
  }

  const label = stringOrNull(raw.label) ?? stringOrNull(raw.name) ?? valueId;
  const description = stringOrNull(raw.description);
  const provider = stringOrNull(raw.provider);

  return {
    value: valueId,
    label,
    description,
    provider
  };
}

export function normalizeProjectModelCatalog(payload: unknown): ProjectModelCatalogOption[] {
  const raw = asRecord(payload);
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(raw.models)
      ? raw.models
      : Array.isArray(raw.data)
        ? raw.data
        : Array.isArray(raw.items)
          ? raw.items
          : [];

  const normalized = candidates.map(normalizeModelCatalogItem).filter((entry): entry is ProjectModelCatalogOption => entry !== null);
  const unique = new Map<string, ProjectModelCatalogOption>();

  for (const option of normalized) {
    if (!unique.has(option.value)) {
      unique.set(option.value, option);
    }
  }

  return [...unique.values()].sort((left, right) => {
    const labelCompare = left.label.localeCompare(right.label, undefined, { sensitivity: "base" });
    if (labelCompare !== 0) {
      return labelCompare;
    }

    return left.value.localeCompare(right.value, undefined, { sensitivity: "base" });
  });
}

export function missingRegistrationFields(input: ProjectRegistrationInput | null): string[] {
  if (!input) {
    return ["name", "repo_url", "default_branch"];
  }

  const missing: string[] = [];

  if (!input.name) missing.push("name");
  if (!input.repo_url) missing.push("repo_url");
  if (!input.default_branch) missing.push("default_branch");

  return missing;
}
