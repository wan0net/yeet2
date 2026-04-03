export type ProjectStatus = "active" | "paused" | "archived";
export type ConstitutionStatus = "missing" | "pending" | "parsed" | "stale" | "failed";
export type ConstitutionParseStatus = ConstitutionStatus;
export type MissionStatus = "draft" | "planned" | "active" | "blocked" | "complete" | "completed" | "cancelled";
export type TaskStatus =
  | "queued"
  | "pending"
  | "ready"
  | "running"
  | "in_progress"
  | "blocked"
  | "done"
  | "complete"
  | "failed";
export type JobStatus = "queued" | "running" | "complete" | "failed" | "cancelled";
export type BlockerStatus = "open" | "resolved" | "dismissed";
export type ConstitutionFileKey = "vision" | "spec" | "roadmap" | "architecture" | "decisions" | "qualityBar";
export type AgentRole = "planner" | "architect" | "implementer" | "qa" | "reviewer" | "visual";
export type DispatchableAgentRole = "implementer" | "qa" | "reviewer";
export type ProjectRoleKey = "planner" | "architect" | "implementer" | "qa" | "reviewer" | "visual";
export type ProjectAutonomyMode = "manual" | "supervised" | "autonomous";
export type ProjectPullRequestMode = "manual" | "after_implementer" | "after_reviewer";
export type ProjectPullRequestDraftMode = "draft" | "ready";
export type ProjectMergeApprovalMode = "human_approval" | "agent_signoff" | "no_approval";
export type ProjectBranchCleanupMode = "manual" | "after_merge";
export type ProjectBranchCleanupState = "pending" | "deleted" | "retained" | "failed";
export type PlanningProvenance = "crewai" | "brain" | "fallback";

export interface ConstitutionFileState {
  key: ConstitutionFileKey;
  path: string;
  exists: boolean;
}

export interface ConstitutionSnapshot {
  vision: ConstitutionFileState;
  spec: ConstitutionFileState;
  roadmap: ConstitutionFileState;
  architecture: ConstitutionFileState;
  decisions: ConstitutionFileState;
  qualityBar: ConstitutionFileState;
}

export interface ConstitutionSummary {
  status: ConstitutionStatus;
  files: ConstitutionSnapshot;
  inspectedAt: string;
  lastIndexedAt?: string | null;
}

export interface Project {
  id: string;
  name: string;
  repoUrl?: string | null;
  githubRepoOwner?: string | null;
  githubRepoName?: string | null;
  githubRepoUrl?: string | null;
  roleDefinitions?: ProjectRoleDefinition[];
  autonomyMode?: ProjectAutonomyMode | null;
  pullRequestMode?: ProjectPullRequestMode | null;
  pullRequestDraftMode?: ProjectPullRequestDraftMode | null;
  mergeApprovalMode?: ProjectMergeApprovalMode | null;
  branchCleanupMode?: ProjectBranchCleanupMode | null;
  lastAutonomyRunAt?: string | null;
  lastAutonomyStatus?: string | null;
  lastAutonomyMessage?: string | null;
  lastAutonomyActor?: string | null;
  nextAutonomyRunAt?: string | null;
  defaultBranch: string;
  localPath: string;
  constitutionStatus: ConstitutionStatus;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRegistrationInput {
  name: string;
  localPath: string;
  repoUrl?: string | null;
  defaultBranch?: string | null;
  createdBy?: string | null;
}

export interface ProjectRegistrationResult {
  project: Project;
  constitution: ConstitutionSummary;
}

export interface ProjectSummary {
  project: Project;
  constitution: ConstitutionSummary;
  roleDefinitions?: ProjectRoleDefinition[];
  dispatchableRoles?: DispatchableAgentRole[];
  nextDispatchableTaskId?: string | null;
  nextDispatchableTaskRole?: DispatchableAgentRole | null;
  activeMissionCount: number;
  activeTaskCount: number;
  blockerCount: number;
  blockers?: ProjectBlockerSummary[];
}

export interface MissionSummary {
  id: string;
  projectId: string;
  title: string;
  objective: string;
  status: MissionStatus;
  createdBy?: string | null;
  planningProvenance?: PlanningProvenance | null;
  startedAt?: string | null;
  completedAt?: string | null;
  taskCount: number;
}

export interface TaskSummary {
  id: string;
  missionId: string;
  title: string;
  description: string;
  agentRole: AgentRole;
  status: TaskStatus;
  priority: number;
  acceptanceCriteria: string[];
  attempts: number;
  blockerReason?: string | null;
  dispatchable?: boolean;
  dispatchBlockedReason?: string | null;
  jobs?: JobSummary[];
}

export interface JobSummary {
  id: string;
  taskId: string;
  executorType: string;
  workspacePath: string;
  branchName: string;
  githubCompareUrl?: string | null;
  githubPrNumber?: number | null;
  githubPrUrl?: string | null;
  githubPrTitle?: string | null;
  githubPrState?: "open" | "closed" | "merged" | null;
  githubPrDraft?: boolean | null;
  githubPrMergedAt?: string | null;
  githubBranchCleanupState?: ProjectBranchCleanupState | null;
  githubBranchDeletedAt?: string | null;
  status: JobStatus;
  logPath?: string | null;
  artifactSummary?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface ProjectDetailSummary {
  project: Project;
  constitution: ConstitutionSummary;
  roleDefinitions?: ProjectRoleDefinition[];
  dispatchableRoles?: DispatchableAgentRole[];
  nextDispatchableTaskId?: string | null;
  nextDispatchableTaskRole?: DispatchableAgentRole | null;
  activeMissionCount: number;
  activeTaskCount: number;
  blockerCount: number;
  blockers?: ProjectBlockerSummary[];
  missions: MissionSummary[];
  tasks: TaskSummary[];
}

export interface ProjectMissionTaskSummary {
  project: Project;
  constitution: ConstitutionSummary;
  mission: MissionSummary | null;
  roleDefinitions?: ProjectRoleDefinition[];
  dispatchableRoles?: DispatchableAgentRole[];
  nextDispatchableTaskId?: string | null;
  nextDispatchableTaskRole?: DispatchableAgentRole | null;
  blockers?: ProjectBlockerSummary[];
  tasks: TaskSummary[];
}

export interface ConstitutionRecord {
  projectId: string;
  visionPath: string;
  specPath: string;
  roadmapPath: string;
  architecturePath?: string | null;
  decisionsPath?: string | null;
  qualityBarPath?: string | null;
  parseStatus: ConstitutionParseStatus;
  lastIndexedAt?: string | null;
}

export interface PlanningTaskDraft {
  title: string;
  description: string;
  agentRole: AgentRole;
  priority: number;
  acceptanceCriteria: string[];
}

export type PlanningTaskSet = readonly [
  PlanningTaskDraft,
  PlanningTaskDraft,
  PlanningTaskDraft,
  ...PlanningTaskDraft[]
];

export interface PlanningMissionDraft {
  title: string;
  objective: string;
  planningProvenance: PlanningProvenance;
}

export interface ProjectRoleDefinition {
  id: string;
  projectId: string;
  roleKey: ProjectRoleKey;
  label: string;
  goal: string;
  backstory: string;
  model?: string | null;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningRequest {
  project: Pick<Project, "id" | "name" | "repoUrl" | "defaultBranch" | "localPath">;
  constitution: ConstitutionSummary;
  requestedBy?: string | null;
}

export interface PlanningResult {
  mission: PlanningMissionDraft;
  tasks: PlanningTaskSet;
  rationale: string;
}

export interface Mission {
  id: string;
  projectId: string;
  title: string;
  objective: string;
  status: MissionStatus;
  createdBy?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface Task {
  id: string;
  missionId: string;
  title: string;
  description: string;
  agentRole: AgentRole;
  status: TaskStatus;
  priority: number;
  acceptanceCriteria: string[];
  attempts: number;
  blockerReason?: string | null;
}

export interface Job {
  id: string;
  taskId: string;
  executorType: string;
  workspacePath: string;
  branchName: string;
  githubCompareUrl?: string | null;
  githubPrNumber?: number | null;
  githubPrUrl?: string | null;
  githubPrTitle?: string | null;
  githubPrState?: "open" | "closed" | "merged" | null;
  githubPrDraft?: boolean | null;
  githubPrMergedAt?: string | null;
  githubBranchCleanupState?: ProjectBranchCleanupState | null;
  githubBranchDeletedAt?: string | null;
  status: JobStatus;
  logPath?: string | null;
  artifactSummary?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface Blocker {
  id: string;
  taskId: string;
  title: string;
  context: string;
  options: string[];
  recommendation?: string | null;
  status: BlockerStatus;
  githubIssueNumber?: number | null;
  githubIssueUrl?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface ProjectBlockerSummary extends Blocker {
  missionId: string;
  taskTitle: string;
  taskStatus: TaskStatus;
  taskAgentRole: AgentRole;
}
