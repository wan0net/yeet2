import { readFile } from "node:fs/promises";

import type { OperatorGuidanceSummary, PlanningProvenance, ProjectRoleDefinition } from "@yeet2/domain";
import type { ConstitutionInspection, ConstitutionFileKey } from "./constitution";

type BrainRequestedBy = Exclude<PlanningProvenance, "fallback">;

export interface PlanningProject {
  id: string;
  name: string;
  repoUrl: string;
  defaultBranch: string;
  localPath: string;
  roleDefinitions: ProjectRoleDefinition[];
  missionHistory: PlanningMissionHistory[];
}

export interface PlanningMissionHistoryTask {
  id: string;
  title: string;
  description: string;
  agentRole: "planner" | "architect" | "implementer" | "qa" | "reviewer" | "visual";
  assignedRoleDefinitionId: string | null;
  assignedRoleDefinitionLabel: string | null;
  status: "queued" | "pending" | "ready" | "running" | "in_progress" | "blocked" | "done" | "complete" | "failed";
  priority: number;
  acceptanceCriteria: string[];
  attempts: number;
  blockerReason: string | null;
}

export interface PlanningMissionHistory {
  id: string;
  title: string;
  objective: string;
  status: "draft" | "planned" | "active" | "blocked" | "complete" | "completed" | "cancelled";
  createdBy: string | null;
  planningProvenance: PlanningProvenance | null;
  startedAt: string | null;
  completedAt: string | null;
  taskCount: number;
  completedTaskCount: number;
  blockedTaskCount: number;
  tasks: PlanningMissionHistoryTask[];
}

export interface PlanningMissionDraft {
  title: string;
  objective: string;
  status: "active";
  createdBy: PlanningProvenance;
  planningProvenance: PlanningProvenance;
}

export interface PlanningTaskDraft {
  title: string;
  description: string;
  agentRole: "planner" | "architect" | "implementer" | "qa" | "reviewer" | "visual";
  assignedRoleDefinitionId?: string | null;
  assignedRoleDefinitionLabel?: string | null;
  status: "ready";
  priority: number;
  acceptanceCriteria: string[];
  attempts: number;
  blockerReason: null;
}

export interface PlanningDraft {
  source: PlanningProvenance;
  mission: PlanningMissionDraft;
  tasks: PlanningTaskDraft[];
}

export interface PlanningContext {
  project: PlanningProject;
  constitution: ConstitutionInspection;
  documents: Partial<Record<ConstitutionFileKey, string | null>>;
  operatorGuidance: OperatorGuidanceSummary[];
}

interface BrainPlanningResponse {
  mission?: Partial<PlanningMissionDraft> | null;
  tasks?: Array<Partial<PlanningTaskDraft> | null> | null;
  source?: string | null;
  plan?: {
    mission?: Partial<PlanningMissionDraft> | null;
    tasks?: Array<Partial<PlanningTaskDraft> | null> | null;
    source?: string | null;
  } | null;
  result?: {
    mission?: Partial<PlanningMissionDraft> | null;
    tasks?: Array<Partial<PlanningTaskDraft> | null> | null;
    source?: string | null;
  } | null;
}

export interface BrainWorkflowDecision {
  projectId: string;
  action: "plan" | "advance" | "pull_request" | "merge" | "idle";
  reason: string;
  source: string;
  targetTaskId?: string | null;
  targetTaskRole?: string | null;
  targetJobId?: string | null;
}

export interface BrainStageBrief {
  projectId: string;
  instructions: string;
  workingSummary: string;
  handoffTargetRole: string | null;
  successSignals: string[];
  source: string;
}

interface BrainPlanningRequestSection {
  title: string;
  text: string;
}

interface BrainPlanningRequest {
  project_id: string;
  project_name: string;
  requested_by: string;
  mission_history: Array<{
    id: string;
    title: string;
    objective: string;
    status: string;
    planning_provenance: PlanningProvenance | null;
    created_by: string | null;
    started_at: string | null;
    completed_at: string | null;
    task_count: number;
    completed_task_count: number;
    blocked_task_count: number;
      tasks: Array<{
        id: string;
        title: string;
        description: string;
        agent_role: string;
        assigned_role_definition_id: string | null;
        assigned_role_definition_label: string | null;
        status: string;
      priority: number;
      acceptance_criteria: string[];
      attempts: number;
      blocker_reason: string | null;
    }>;
  }>;
  constitution: Partial<Record<ConstitutionFileKey, BrainPlanningRequestSection>>;
  constitution_files: Partial<Record<ConstitutionFileKey, BrainPlanningRequestSection>>;
  role_definitions: Array<{
    key: string;
    label: string;
    goal: string;
    backstory: string;
    model: string | null;
    enabled: boolean;
    sort_order: number;
  }>;
  operator_guidance: Array<{
    id: string;
    actor: string;
    content: string;
    mentions: string[];
    reply_to_id: string | null;
    created_at: string;
  }>;
}

type PlanningBackend = "brain" | "crewai" | "deterministic";

function brainBaseUrl(): string {
  return (process.env.YEET2_BRAIN_BASE_URL ?? process.env.BRAIN_BASE_URL ?? "http://127.0.0.1:8011").replace(/\/+$/, "");
}

async function readBrainJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), brainPlanningTimeoutMs());

  try {
    const response = await fetch(`${brainBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const rawText = await response.text();
    let parsed: unknown = null;
    if (rawText) {
      parsed = JSON.parse(rawText);
    }

    if (!response.ok || typeof parsed !== "object" || parsed === null) {
      throw new Error(`Brain request failed for ${path}`);
    }

    return parsed as T;
  } finally {
    clearTimeout(timeout);
  }
}

function brainPlanningTimeoutMs(): number {
  const raw = cleanText(process.env.YEET2_BRAIN_PLAN_TIMEOUT_MS);
  if (!raw) {
    return 45_000;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 45_000;
  }

  return Math.max(1_000, Math.floor(parsed));
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizePlanningProvenance(value: unknown, fallback: PlanningProvenance): PlanningProvenance {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "crewai" || normalized === "brain" || normalized === "fallback") {
    return normalized;
  }

  if (normalized === "brain" || normalized === "system" || normalized === "api") {
    return fallback === "fallback" ? "brain" : fallback;
  }

  return fallback;
}

function runtimePrefersCrewAI(): boolean {
  const backend = cleanText(process.env.YEET2_BRAIN_PLANNER_BACKEND).toLowerCase();
  if (backend === "crewai") {
    return true;
  }

  if (backend === "deterministic") {
    return false;
  }

  return Boolean(
    cleanText(process.env.YEET2_BRAIN_CREWAI_MODEL) ||
      cleanText(process.env.OPENAI_MODEL_NAME) ||
      cleanText(process.env.MODEL) ||
      ["1", "true", "yes", "on"].includes(cleanText(process.env.YEET2_BRAIN_CREWAI_ENABLED).toLowerCase())
  );
}

function planningBackend(): PlanningBackend {
  const backend = cleanText(process.env.YEET2_BRAIN_PLANNER_BACKEND).toLowerCase();
  if (backend === "deterministic") {
    return "deterministic";
  }

  if (backend === "crewai") {
    return "crewai";
  }

  return runtimePrefersCrewAI() ? "crewai" : "brain";
}

function requestedPlanningProvenance(): BrainRequestedBy {
  return runtimePrefersCrewAI() ? "crewai" : "brain";
}

function normalizeAgentRole(value: unknown): PlanningTaskDraft["agentRole"] | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "planner":
    case "architect":
    case "implementer":
    case "qa":
    case "reviewer":
    case "visual":
      return normalized;
    default:
      return null;
  }
}

function firstMeaningfulLine(text: string | null | undefined, fallback: string): string {
  const trimmed = cleanText(text);
  if (!trimmed) {
    return fallback;
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const heading = lines.find((line) => line.startsWith("#"));
  if (heading) {
    return heading.replace(/^#+\s*/, "").trim() || fallback;
  }

  return lines[0] || fallback;
}

function buildBrainPlanningRequest(context: PlanningContext, requestedBy: BrainRequestedBy): BrainPlanningRequest {
  const mission_history = context.project.missionHistory.map((mission) => ({
    id: mission.id,
    title: mission.title,
    objective: mission.objective,
    status: mission.status,
    planning_provenance: mission.planningProvenance,
    created_by: mission.createdBy,
    started_at: mission.startedAt,
    completed_at: mission.completedAt,
    task_count: mission.taskCount,
    completed_task_count: mission.completedTaskCount,
    blocked_task_count: mission.blockedTaskCount,
    tasks: mission.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      agent_role: task.agentRole,
      assigned_role_definition_id: task.assignedRoleDefinitionId,
      assigned_role_definition_label: task.assignedRoleDefinitionLabel,
      status: task.status,
      priority: task.priority,
      acceptance_criteria: task.acceptanceCriteria,
      attempts: task.attempts,
      blocker_reason: task.blockerReason
    }))
  }));

  const sections = (Object.keys(context.constitution.files) as ConstitutionFileKey[]).reduce(
    (acc, key) => {
      const file = context.constitution.files[key];
      const text = cleanText(context.documents[key]);

      acc.constitution[key] = {
        title: key,
        text
      };
      acc.constitution_files[key] = {
        title: file.path,
        text
      };

      return acc;
    },
    {
      constitution: {} as Partial<Record<ConstitutionFileKey, BrainPlanningRequestSection>>,
      constitution_files: {} as Partial<Record<ConstitutionFileKey, BrainPlanningRequestSection>>
    }
  );

  return {
    project_id: context.project.id,
    project_name: context.project.name,
    requested_by: requestedBy,
    mission_history,
    constitution: sections.constitution,
    constitution_files: sections.constitution_files,
    role_definitions: context.project.roleDefinitions.map((definition) => ({
      key: definition.roleKey,
      label: definition.label,
      goal: definition.goal,
      backstory: definition.backstory,
      model: definition.model ?? null,
      enabled: definition.enabled,
      sort_order: definition.sortOrder
    })),
    operator_guidance: context.operatorGuidance.map((entry) => ({
      id: entry.id,
      actor: entry.actor,
      content: entry.content,
      mentions: entry.mentions,
      reply_to_id: entry.replyToId ?? null,
      created_at: entry.createdAt
    }))
  };
}

async function readDocument(path: string, exists: boolean): Promise<string | null> {
  if (!exists) {
    return null;
  }

  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

export async function loadPlanningContext(
  project: PlanningProject,
  constitution: ConstitutionInspection,
  operatorGuidance: OperatorGuidanceSummary[] = []
): Promise<PlanningContext> {
  const entries = await Promise.all(
    (Object.keys(constitution.files) as ConstitutionFileKey[]).map(async (key) => {
      const file = constitution.files[key];
      return [key, await readDocument(file.absolutePath, file.exists)] as const;
    })
  );

  return {
    project,
    constitution,
    documents: Object.fromEntries(entries) as Partial<Record<ConstitutionFileKey, string | null>>,
    operatorGuidance
  };
}

export async function decideWorkflowAction(input: {
  projectId: string;
  projectName: string;
  autonomyMode: string;
  hasInFlightJobs: boolean;
  needsInitialPlanning: boolean;
  needsBacklogPlanning: boolean;
  nextDispatchableTaskId: string | null;
  nextDispatchableTaskRole: string | null;
  pullRequestMode: string;
  pullRequestDraftMode: string;
  mergeApprovalMode: string;
  latestCompletedJobId: string | null;
  latestCompletedTaskId: string | null;
  latestCompletedTaskTitle: string | null;
  latestCompletedJobHasPullRequest: boolean;
  latestCompletedReviewerComplete: boolean;
  latestCompletedDispatchableTasksComplete: boolean;
}): Promise<BrainWorkflowDecision> {
  return readBrainJson<BrainWorkflowDecision>("/orchestration/decide", {
    project_id: input.projectId,
    project_name: input.projectName,
    autonomy_mode: input.autonomyMode,
    has_in_flight_jobs: input.hasInFlightJobs,
    needs_initial_planning: input.needsInitialPlanning,
    needs_backlog_planning: input.needsBacklogPlanning,
    next_dispatchable_task_id: input.nextDispatchableTaskId,
    next_dispatchable_task_role: input.nextDispatchableTaskRole,
    pull_request_mode: input.pullRequestMode,
    pull_request_draft_mode: input.pullRequestDraftMode,
    merge_approval_mode: input.mergeApprovalMode,
    latest_completed_job_id: input.latestCompletedJobId,
    latest_completed_task_id: input.latestCompletedTaskId,
    latest_completed_task_title: input.latestCompletedTaskTitle,
    latest_completed_job_has_pull_request: input.latestCompletedJobHasPullRequest,
    latest_completed_reviewer_complete: input.latestCompletedReviewerComplete,
    latest_completed_dispatchable_tasks_complete: input.latestCompletedDispatchableTasksComplete
  });
}

export async function createTaskStageBrief(input: {
  projectId: string;
  projectName: string;
  missionId: string;
  missionTitle: string;
  missionObjective: string;
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  taskAgentRole: string;
  taskPriority: number;
  taskAttempts: number;
  acceptanceCriteria: string[];
  assignedRoleLabel: string | null;
  assignedRoleGoal: string | null;
  assignedRoleBackstory: string | null;
  operatorGuidance: OperatorGuidanceSummary[];
}): Promise<BrainStageBrief> {
  return readBrainJson<BrainStageBrief>("/orchestration/brief", {
    project_id: input.projectId,
    project_name: input.projectName,
    mission_id: input.missionId,
    mission_title: input.missionTitle,
    mission_objective: input.missionObjective,
    task_id: input.taskId,
    task_title: input.taskTitle,
    task_description: input.taskDescription,
    task_agent_role: input.taskAgentRole,
    task_priority: input.taskPriority,
    task_attempts: input.taskAttempts,
    acceptance_criteria: input.acceptanceCriteria,
    assigned_role_label: input.assignedRoleLabel,
    assigned_role_goal: input.assignedRoleGoal,
    assigned_role_backstory: input.assignedRoleBackstory,
    operator_guidance: input.operatorGuidance.map((entry) => ({
      id: entry.id,
      actor: entry.actor,
      content: entry.content,
      mentions: entry.mentions,
      reply_to_id: entry.replyToId ?? null,
      created_at: entry.createdAt
    }))
  });
}

function buildFallbackDraft(context: PlanningContext): PlanningDraft {
  const visionHeadline = firstMeaningfulLine(context.documents.vision, "Project vision");
  const specHeadline = firstMeaningfulLine(context.documents.spec, "Project specification");
  const roadmapHeadline = firstMeaningfulLine(context.documents.roadmap, "First roadmap slice");
  const architectureHeadline = firstMeaningfulLine(context.documents.architecture, "Architecture review");
  const projectName = context.project.name || "the project";
  const latestGuidance = context.operatorGuidance[0]?.content ?? "";
  const guidanceSuffix = latestGuidance ? ` Latest operator guidance: ${latestGuidance}` : "";

  return {
    source: "fallback",
    mission: {
      title: `Launch the first constitutional slice for ${projectName}`,
      objective: `Turn the constitution into a first implementation pass grounded in ${visionHeadline}, ${specHeadline}, and ${roadmapHeadline}.${guidanceSuffix}`,
      status: "active",
      createdBy: "fallback",
      planningProvenance: "fallback"
    },
    tasks: [
      {
        title: "Validate the constitution and scope",
        description: `Read the project constitution for ${projectName} and confirm the initial delivery target.${guidanceSuffix}`,
        agentRole: "architect",
        status: "ready",
        priority: 1,
        acceptanceCriteria: [
          "The VISION, SPEC, and ROADMAP files are present and understood.",
          "The first implementation slice is clearly bounded.",
          "Any ambiguity is called out before coding starts."
        ],
        attempts: 0,
        blockerReason: null
      },
      {
        title: `Implement the first roadmap slice: ${roadmapHeadline}`,
        description: `Carry out the smallest useful change implied by the roadmap and spec.${guidanceSuffix}`,
        agentRole: "implementer",
        status: "ready",
        priority: 2,
        acceptanceCriteria: [
          "The implementation aligns with the roadmap direction.",
          "The change is isolated and reviewable.",
          "A concise summary of the diff is produced."
        ],
        attempts: 0,
        blockerReason: null
      },
      {
        title: `Run validation for ${roadmapHeadline}`,
        description: `Execute tests or other verification that demonstrates the slice is safe.${guidanceSuffix}`,
        agentRole: "qa",
        status: "ready",
        priority: 3,
        acceptanceCriteria: [
          "The change has a verification path.",
          "Any failing checks are surfaced clearly.",
          "The result is recorded for review."
        ],
        attempts: 0,
        blockerReason: null
      },
      {
        title: `Review the architecture around ${architectureHeadline}`,
        description: `Check the result against the constitution and identify any follow-up work.${guidanceSuffix}`,
        agentRole: "reviewer",
        status: "ready",
        priority: 4,
        acceptanceCriteria: [
          "The output is checked against the constitution.",
          "Maintainability risks are identified.",
          "Any blocker or follow-up is captured."
        ],
        attempts: 0,
        blockerReason: null
      }
    ]
  };
}

function normalizeMissionDraft(value: unknown, fallback: PlanningMissionDraft): PlanningMissionDraft {
  if (typeof value !== "object" || value === null) {
    return fallback;
  }

  const raw = value as Record<string, unknown>;
  const title = cleanText(typeof raw.title === "string" ? raw.title : undefined) || fallback.title;
  const objective = cleanText(typeof raw.objective === "string" ? raw.objective : undefined) || fallback.objective;
  const status = raw.status === "active" ? "active" : fallback.status;
  const planningProvenance = normalizePlanningProvenance(raw.planningProvenance ?? raw.createdBy, fallback.planningProvenance);
  const createdBy = planningProvenance;

  return {
    title,
    objective,
    status,
    createdBy,
    planningProvenance
  };
}

function normalizeTaskDraft(value: unknown, fallbackPriority: number): PlanningTaskDraft | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const title = cleanText(typeof raw.title === "string" ? raw.title : undefined);
  const description = cleanText(typeof raw.description === "string" ? raw.description : undefined);
  const agentRole = normalizeAgentRole(raw.agentRole);

  if (!title || !description || !agentRole) {
    return null;
  }

  const acceptanceCriteria = Array.isArray(raw.acceptanceCriteria)
    ? raw.acceptanceCriteria.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];

  return {
    title,
    description,
    agentRole,
    assignedRoleDefinitionId: cleanText(typeof raw.assignedRoleDefinitionId === "string" ? raw.assignedRoleDefinitionId : typeof raw.assigned_role_definition_id === "string" ? raw.assigned_role_definition_id : undefined) || null,
    assignedRoleDefinitionLabel: cleanText(typeof raw.assignedRoleDefinitionLabel === "string" ? raw.assignedRoleDefinitionLabel : typeof raw.assigned_role_definition_label === "string" ? raw.assigned_role_definition_label : undefined) || null,
    status: raw.status === "ready" ? "ready" : "ready",
    priority: typeof raw.priority === "number" && Number.isFinite(raw.priority) ? raw.priority : fallbackPriority,
    acceptanceCriteria,
    attempts: typeof raw.attempts === "number" && Number.isFinite(raw.attempts) ? raw.attempts : 0,
    blockerReason: null
  };
}

function extractBrainDraft(payload: unknown, fallback: PlanningDraft, provenance: BrainRequestedBy): PlanningDraft {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Brain planning response must be an object");
  }

  const raw = payload as Record<string, unknown>;
  const fromPlan = typeof raw.plan === "object" && raw.plan !== null ? (raw.plan as Record<string, unknown>) : null;
  const fromResult = typeof raw.result === "object" && raw.result !== null ? (raw.result as Record<string, unknown>) : null;
  const draftProvenance = normalizePlanningProvenance(raw.source ?? raw.planningProvenance ?? fromPlan?.source ?? fromPlan?.planningProvenance ?? fromResult?.source ?? fromResult?.planningProvenance, provenance);

  const missionValue = raw.mission ?? fromPlan?.mission ?? fromResult?.mission;
  const taskValues = raw.tasks ?? fromPlan?.tasks ?? fromResult?.tasks;
  if (!missionValue) {
    throw new Error("Brain planning response is missing a mission");
  }
  if (!Array.isArray(taskValues)) {
    throw new Error("Brain planning response is missing tasks");
  }
  const mission = normalizeMissionDraft(missionValue, fallback.mission);
  const tasks = taskValues.map((value, index) => {
    const task = normalizeTaskDraft(value, index + 1);
    if (!task) {
      throw new Error(`Brain planning response contains an invalid task at index ${index}`);
    }
    return task;
  });

  if (!tasks.length) {
    throw new Error("Brain planning response did not include any tasks");
  }

  return {
    source: draftProvenance,
    mission,
    tasks
  };
}

async function callBrainPlanner(context: PlanningContext, provenance: BrainRequestedBy): Promise<PlanningDraft> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), brainPlanningTimeoutMs());

  try {
    const response = await fetch(`${brainBaseUrl()}/orchestration/plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(buildBrainPlanningRequest(context, provenance)),
      signal: controller.signal
    });

    if (!response.ok) {
      const details = cleanText(await response.text().catch(() => ""));
      throw new Error(
        details
          ? `Brain planning failed with HTTP ${response.status}: ${details}`
          : `Brain planning failed with HTTP ${response.status}`
      );
    }

    const payload = (await response.json().catch(() => null)) as unknown;
    if (payload === null) {
      throw new Error("Brain planning returned invalid JSON");
    }

    const fallback = buildFallbackDraft(context);
    return extractBrainDraft(payload, fallback, provenance);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Brain planning request timed out after ${brainPlanningTimeoutMs()} ms`);
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Brain planning request failed");
  } finally {
    clearTimeout(timeout);
  }
}

export async function createInitialPlan(context: PlanningContext): Promise<PlanningDraft> {
  if (planningBackend() === "deterministic") {
    return buildFallbackDraft(context);
  }

  return callBrainPlanner(context, requestedPlanningProvenance());
}
