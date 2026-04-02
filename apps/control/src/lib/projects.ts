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
  startedAt: string | null;
  completedAt: string | null;
  tasks: ProjectTaskRecord[];
}

export interface ProjectRecord {
  id: string;
  name: string;
  repoUrl: string;
  defaultBranch: string;
  localPath: string;
  constitutionStatus: ConstitutionStatus;
  constitution: ConstitutionSummary;
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

function stripGitSuffix(value: string): string {
  return value.endsWith(".git") ? value.slice(0, -4) : value;
}

export function parseGitHubRepoUrl(value: string): GitHubRepoInfo | null {
  const normalized = value.trim().replace(/\/+$/, "");
  if (!normalized) {
    return null;
  }

  const httpsMatch = normalized.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (httpsMatch) {
    const owner = httpsMatch[1];
    const repo = stripGitSuffix(httpsMatch[2]);
    return {
      owner,
      repo,
      webUrl: `https://github.com/${owner}/${repo}`
    };
  }

  const sshMatch = normalized.match(/^(?:ssh:\/\/)?git@github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshMatch) {
    const owner = sshMatch[1];
    const repo = stripGitSuffix(sshMatch[2]);
    return {
      owner,
      repo,
      webUrl: `https://github.com/${owner}/${repo}`
    };
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
    completedAt: stringValue(raw.completedAt, raw.completed_at) || null
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
  const defaultBranch = stringValue(raw.defaultBranch, raw.default_branch);
  const localPath = stringValue(raw.localPath, raw.local_path);
  const id = stringValue(raw.id, raw.projectId, raw.project_id) || `project-${fallbackIndex}`;
  const missions = normalizeMissions(raw);
  const constitution = normalizeConstitutionSummary(raw);
  const blockers = normalizeBlockers(raw);

  if (!name && !repoUrl && !localPath) {
    return null;
  }

  return {
    id,
    name: name || repoUrl || id,
    repoUrl,
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
