import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type {
  ProjectApprovalAction,
  ProjectAutonomyMode,
  ProjectBranchCleanupMode,
  ProjectPullRequestDraftMode,
  ProjectPullRequestMode,
  ProjectRoleKey
} from "@yeet2/domain";

import { RepositoryPathError } from "../constitution";
import type { AutonomyLoopManager } from "../autonomy-loop";
import { prisma } from "../db";
import { listProjectDecisionLogs } from "../decision-logs";
import { buildFallbackModelCatalog, fetchOpenRouterModelCatalog, OpenRouterModelCatalogError } from "../openrouter-models";
import {
  advanceProject,
  createProjectBlockerGitHubIssue,
  createProjectPullRequest,
  listGlobalBlockers,
  listGlobalJobs,
  readProjectJobLog,
  listProjectApprovals,
  refreshProjectActiveJobs,
  refreshProjectJob,
  applyProjectBlockerApproval,
  dispatchTask,
  getRegisteredProject,
  listRegisteredProjects,
  registerProject,
  planProject,
  resolveProjectBlocker,
  ProjectBlockerError,
  ProjectDispatchError,
  ProjectApprovalError,
  ProjectGitHubIssueError,
  ProjectRegistrationError,
  ProjectAutonomyError,
  ProjectJobRefreshError,
  ProjectRoleDefinitionError,
  ProjectJobLogError,
  ProjectPullRequestError,
  createProjectMessage,
  replaceProjectRoleDefinitions,
  readProjectCostAnalysis,
  updateProjectAutonomy,
  type ProjectRegistrationInput
} from "../projects";

function parseProjectRegistrationBody(body: unknown): { input: ProjectRegistrationInput | null; error: string | null } {
  if (typeof body !== "object" || body === null) {
    return {
      input: null,
      error: "Request body must be an object"
    };
  }

  const candidate = body as Record<string, unknown>;
  const readString = (camelKey: string, snakeKey: string) => {
    const value = candidate[camelKey] ?? candidate[snakeKey];
    return typeof value === "string" ? value.trim() : "";
  };

  const name = readString("name", "name");
  const repoUrl = readString("repoUrl", "repo_url");
  const defaultBranch = readString("defaultBranch", "default_branch");
  const localPath = readString("localPath", "local_path");

  if (!name) {
    return {
      input: null,
      error: "name is required"
    };
  }

  if (!defaultBranch) {
    return {
      input: null,
      error: "defaultBranch is required"
    };
  }

  if (!localPath && !repoUrl) {
    return {
      input: null,
      error: "Provide localPath to attach an existing checkout or repoUrl to clone a repository"
    };
  }

  return {
    input: {
      name,
      repoUrl: repoUrl || null,
      defaultBranch,
      localPath: localPath || null
    },
    error: null
  };
}

function parseProjectRoleDefinitionsBody(body: unknown): { input: Array<{ roleKey: ProjectRoleKey; visualName: string; label: string; goal: string; backstory: string; model: string | null; enabled: boolean; sortOrder: number }> | null; error: string | null } {
  if (typeof body !== "object" || body === null) {
    return {
      input: null,
      error: "Request body must be an object"
    };
  }

  const candidate = body as Record<string, unknown>;
  const rawDefinitions = candidate.roleDefinitions;
  if (!Array.isArray(rawDefinitions)) {
    return {
      input: null,
      error: "roleDefinitions is required"
    };
  }

  const parsedDefinitions = rawDefinitions
    .map((definition) => {
      if (typeof definition !== "object" || definition === null) {
        return null;
      }

      const raw = definition as Record<string, unknown>;
      const roleKey = typeof raw.roleKey === "string" ? (raw.roleKey.trim() as ProjectRoleKey) : "";
      const visualName =
        typeof raw.visualName === "string"
          ? raw.visualName.trim()
          : typeof raw.visual_name === "string"
            ? raw.visual_name.trim()
            : typeof raw.label === "string"
              ? raw.label.trim()
              : "";
      const goal = typeof raw.goal === "string" ? raw.goal.trim() : "";
      const backstory = typeof raw.backstory === "string" ? raw.backstory.trim() : "";
      const model = typeof raw.model === "string" ? raw.model.trim() : null;
      const enabled = typeof raw.enabled === "boolean" ? raw.enabled : true;
      const sortOrder = typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder) ? Math.trunc(raw.sortOrder) : 0;

      if (
        roleKey !== "planner" &&
        roleKey !== "architect" &&
        roleKey !== "implementer" &&
        roleKey !== "qa" &&
        roleKey !== "reviewer" &&
        roleKey !== "visual"
      ) {
        return null;
      }

      if (!visualName || !goal || !backstory) {
        return null;
      }

      return {
        roleKey,
        visualName,
        label: visualName,
        goal,
        backstory,
        model: model ? model : null,
        enabled,
        sortOrder
      };
    })
    .filter((definition): definition is NonNullable<typeof definition> => definition !== null);

  if (!parsedDefinitions.length) {
    return {
      input: null,
      error: "roleDefinitions must include at least one definition"
    };
  }

  return {
    input: parsedDefinitions,
    error: null
  };
}

function parseProjectMessageBody(body: unknown): { input: { content: string; replyToId: string | null } | null; error: string | null } {
  if (typeof body !== "object" || body === null) {
    return {
      input: null,
      error: "Request body must be an object"
    };
  }

  const candidate = body as Record<string, unknown>;
  const content =
    typeof candidate.content === "string"
      ? candidate.content.trim()
      : typeof candidate.message === "string"
        ? candidate.message.trim()
        : "";
  const replyToId =
    typeof candidate.replyToId === "string"
      ? candidate.replyToId.trim()
      : typeof candidate.reply_to_id === "string"
        ? candidate.reply_to_id.trim()
        : "";

  if (!content) {
    return {
      input: null,
      error: "content is required"
    };
  }

  return {
    input: {
      content,
      replyToId: replyToId || null
    },
    error: null
  };
}

function parseProjectAutonomyBody(body: unknown): {
      input:
        | {
            autonomyMode: ProjectAutonomyMode;
            pullRequestMode?: ProjectPullRequestMode;
            pullRequestDraftMode?: ProjectPullRequestDraftMode;
            mergeApprovalMode?: import("@yeet2/domain").ProjectMergeApprovalMode;
            branchCleanupMode?: ProjectBranchCleanupMode;
          }
    | null;
  error: string | null;
} {
  if (typeof body !== "object" || body === null) {
    return {
      input: null,
      error: "Request body must be an object"
    };
  }

  const candidate = body as Record<string, unknown>;
  const rawMode = candidate.autonomyMode ?? candidate.autonomy_mode;
  if (typeof rawMode !== "string") {
    return {
      input: null,
      error: "autonomyMode is required"
    };
  }

  const autonomyMode = rawMode.trim().toLowerCase();
  if (autonomyMode !== "manual" && autonomyMode !== "supervised" && autonomyMode !== "autonomous") {
    return {
      input: null,
      error: "autonomyMode must be manual, supervised, or autonomous"
    };
  }

  const rawPullRequestMode = candidate.pullRequestMode ?? candidate.pull_request_mode;
  const pullRequestMode =
    typeof rawPullRequestMode === "string" ? rawPullRequestMode.trim().toLowerCase() : "";
  if (pullRequestMode && pullRequestMode !== "manual" && pullRequestMode !== "after_implementer" && pullRequestMode !== "after_reviewer") {
    return {
      input: null,
      error: "pullRequestMode must be manual, after_implementer, or after_reviewer"
    };
  }

  const rawPullRequestDraftMode = candidate.pullRequestDraftMode ?? candidate.pull_request_draft_mode;
  const pullRequestDraftMode =
    typeof rawPullRequestDraftMode === "string" ? rawPullRequestDraftMode.trim().toLowerCase() : "";
  if (pullRequestDraftMode && pullRequestDraftMode !== "draft" && pullRequestDraftMode !== "ready") {
    return {
      input: null,
      error: "pullRequestDraftMode must be draft or ready"
    };
  }

  const rawMergeApprovalMode = candidate.mergeApprovalMode ?? candidate.merge_approval_mode;
  const mergeApprovalMode =
    typeof rawMergeApprovalMode === "string" ? rawMergeApprovalMode.trim().toLowerCase() : "";
  if (
    mergeApprovalMode &&
    mergeApprovalMode !== "human_approval" &&
    mergeApprovalMode !== "agent_signoff" &&
    mergeApprovalMode !== "no_approval"
  ) {
    return {
      input: null,
      error: "mergeApprovalMode must be human_approval, agent_signoff, or no_approval"
    };
  }

  const rawBranchCleanupMode = candidate.branchCleanupMode ?? candidate.branch_cleanup_mode;
  const branchCleanupMode =
    typeof rawBranchCleanupMode === "string" ? rawBranchCleanupMode.trim().toLowerCase() : "";
  if (branchCleanupMode && branchCleanupMode !== "manual" && branchCleanupMode !== "after_merge") {
    return {
      input: null,
      error: "branchCleanupMode must be manual or after_merge"
    };
  }

  return {
    input: {
      autonomyMode,
      ...(pullRequestMode ? { pullRequestMode: pullRequestMode as ProjectPullRequestMode } : {}),
      ...(pullRequestDraftMode ? { pullRequestDraftMode: pullRequestDraftMode as ProjectPullRequestDraftMode } : {}),
      ...(mergeApprovalMode ? { mergeApprovalMode: mergeApprovalMode as import("@yeet2/domain").ProjectMergeApprovalMode } : {}),
      ...(branchCleanupMode ? { branchCleanupMode: branchCleanupMode as ProjectBranchCleanupMode } : {})
    },
    error: null
  };
}

function parseProjectApprovalBody(body: unknown): { input: { action: ProjectApprovalAction } | null; error: string | null } {
  if (typeof body !== "object" || body === null) {
    return {
      input: null,
      error: "Request body must be an object"
    };
  }

  const candidate = body as Record<string, unknown>;
  const rawAction = candidate.action ?? candidate.approvalAction ?? candidate.approval_action;
  if (typeof rawAction !== "string") {
    return {
      input: null,
      error: "action is required"
    };
  }

  const action = rawAction.trim().toLowerCase();
  if (action !== "approve" && action !== "reject") {
    return {
      input: null,
      error: "action must be approve or reject"
    };
  }

  return {
    input: { action: action as ProjectApprovalAction },
    error: null
  };
}

export const registerProjectRoutes: FastifyPluginAsync<{ loopManager: AutonomyLoopManager }> = async (
  app: FastifyInstance,
  options
) => {
  async function triggerProjectRunIfEnabled(projectId: string): Promise<{
    runTriggered: boolean;
    telemetry: Awaited<ReturnType<AutonomyLoopManager["triggerProject"]>> | null;
    triggerError: string | null;
  }> {
    const project = await getRegisteredProject(projectId);
    const shouldTriggerRun = Boolean(project.project && project.project.autonomyMode !== "manual");
    if (!shouldTriggerRun) {
      return {
        runTriggered: false,
        telemetry: null,
        triggerError: null
      };
    }

    try {
      const telemetry = await options.loopManager.triggerProject(projectId);
      return {
        runTriggered: true,
        telemetry,
        triggerError: null
      };
    } catch (error) {
      const triggerError = error instanceof Error ? error.message : "Unable to trigger project run";
      app.log.error({ error, projectId }, "Unable to trigger project run");
      return {
        runTriggered: true,
        telemetry: null,
        triggerError
      };
    }
  }

  app.get("/projects", async () => {
    return listRegisteredProjects();
  });

  app.get("/jobs", async (request, reply) => {
    const query = (request.query ?? {}) as {
      status?: string;
      projectId?: string;
      project_id?: string;
    };
    const status =
      typeof query.status === "string" && query.status.trim()
        ? query.status.trim().toLowerCase()
        : "all";

    if (status !== "all" && status !== "queued" && status !== "running" && status !== "complete" && status !== "failed" && status !== "cancelled") {
      return reply.code(400).send({
        error: "validation_error",
        message: "status must be all, queued, running, complete, failed, or cancelled"
      });
    }

    return reply.code(200).send(
      await listGlobalJobs({
        status,
        projectId:
          typeof query.projectId === "string"
            ? query.projectId
            : typeof query.project_id === "string"
              ? query.project_id
              : null
      })
    );
  });

  app.get("/blockers", async (request, reply) => {
    const query = (request.query ?? {}) as {
      status?: string;
      projectId?: string;
      project_id?: string;
    };
    const status =
      typeof query.status === "string" && query.status.trim()
        ? query.status.trim().toLowerCase()
        : "all";

    if (status !== "all" && status !== "open" && status !== "resolved" && status !== "dismissed") {
      return reply.code(400).send({
        error: "validation_error",
        message: "status must be all, open, resolved, or dismissed"
      });
    }

    return reply.code(200).send(
      await listGlobalBlockers({
        status,
        projectId:
          typeof query.projectId === "string"
            ? query.projectId
            : typeof query.project_id === "string"
              ? query.project_id
              : null
      })
    );
  });

  app.get("/approvals", async (request, reply) => {
    const query = (request.query ?? {}) as {
      projectId?: string;
      project_id?: string;
      status?: string;
    };

    const status =
      typeof query.status === "string" && query.status.trim()
        ? query.status.trim().toLowerCase()
        : "all";

    if (status !== "all" && status !== "open" && status !== "resolved" && status !== "dismissed") {
      return reply.code(400).send({
        error: "validation_error",
        message: "status must be all, open, resolved, or dismissed"
      });
    }

    return reply.code(200).send(
      await listProjectApprovals({
        projectId:
          typeof query.projectId === "string"
            ? query.projectId
            : typeof query.project_id === "string"
              ? query.project_id
              : null,
        status
      })
    );
  });

  app.get("/projects/models", async (_request, reply) => {
    try {
      const models = await fetchOpenRouterModelCatalog();
      return reply.code(200).send({ models });
    } catch (error) {
      if (error instanceof OpenRouterModelCatalogError) {
        const configuredModels = await prisma.projectRoleDefinition.findMany({
          where: {
            model: {
              not: null
            }
          },
          select: {
            model: true
          }
        });

        return reply.code(200).send({
          models: buildFallbackModelCatalog(configuredModels.map((entry) => entry.model ?? "").filter(Boolean)),
          degraded: true,
          warning: error.message
        });
      }

      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to load the model catalog"
      });
    }
  });

  app.get("/projects/:projectId", async (request, reply) => {
    const { projectId } = request.params as { projectId?: string };
    if (!projectId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "projectId is required"
      });
    }

    const rawRefresh = (request.query as { refreshActiveJobs?: string | boolean } | undefined)?.refreshActiveJobs;
    const refreshActiveJobsRequested =
      rawRefresh === true ||
      rawRefresh === "true" ||
      rawRefresh === "1" ||
      rawRefresh === "yes";

    if (refreshActiveJobsRequested) {
      try {
        const result = await refreshProjectActiveJobs(projectId);
        return { project: result.project, refreshedJobIds: result.refreshedJobIds };
      } catch (error) {
        if (error instanceof ProjectJobRefreshError) {
          return reply.code(error.statusCode).send({
            error: error.code,
            message: error.message
          });
        }

        app.log.error(error);
        return reply.code(500).send({
          error: "internal_error",
          message: "Unable to refresh active jobs for the project"
        });
      }
    }

    const project = await getRegisteredProject(projectId);
    if (!project.project) {
      return reply.code(404).send({
        error: "project_not_found",
        message: "Project not found"
      });
    }

    return project;
  });

  app.get("/projects/:projectId/cost-analysis", async (request, reply) => {
    const { projectId } = request.params as { projectId?: string };
    if (!projectId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "projectId is required"
      });
    }

    try {
      const analysis = await readProjectCostAnalysis(projectId);
      return reply.code(200).send({ analysis });
    } catch (error) {
      if (error instanceof ProjectRegistrationError || error instanceof ProjectRoleDefinitionError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }

      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to load project cost analysis"
      });
    }
  });

  app.get("/projects/:projectId/activity", async (request, reply) => {
    const { projectId } = request.params as { projectId?: string };
    if (!projectId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "projectId is required"
      });
    }

    const query = (request.query ?? {}) as {
      take?: string | number;
      kind?: string;
      actor?: string;
      mention?: string;
      replyToId?: string;
      reply_to_id?: string;
    };

    const take =
      typeof query.take === "number"
        ? query.take
        : typeof query.take === "string" && query.take.trim()
          ? Number(query.take)
          : undefined;

    try {
      const activity = await listProjectDecisionLogs(projectId, {
        take: Number.isFinite(take) ? Number(take) : undefined,
        kind: typeof query.kind === "string" ? query.kind : null,
        actor: typeof query.actor === "string" ? query.actor : null,
        mention: typeof query.mention === "string" ? query.mention : null,
        replyToId:
          typeof query.replyToId === "string"
            ? query.replyToId
            : typeof query.reply_to_id === "string"
              ? query.reply_to_id
              : null
      });
      return reply.code(200).send({ activity });
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to load project activity"
      });
    }
  });

  app.put("/projects/:projectId/autonomy", async (request, reply) => {
    const { projectId } = request.params as { projectId?: string };
    if (!projectId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "projectId is required"
      });
    }

    const parsedBody = parseProjectAutonomyBody(request.body);
    if (!parsedBody.input) {
      return reply.code(400).send({
        error: "validation_error",
        message: parsedBody.error ?? "Invalid project autonomy body"
      });
    }

    try {
      const project = await updateProjectAutonomy(projectId, parsedBody.input);
      const run = await triggerProjectRunIfEnabled(projectId);
      return reply.code(200).send({ project, ...run });
    } catch (error) {
      if (error instanceof ProjectAutonomyError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }

      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to update project autonomy"
      });
    }
  });

  app.post("/projects/:projectId/run", async (request, reply) => {
    const { projectId } = request.params as { projectId?: string };
    if (!projectId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "projectId is required"
      });
    }

    try {
      const telemetry = await options.loopManager.triggerProject(projectId);
      const project = await getRegisteredProject(projectId);
      return reply.code(200).send({
        project: project.project,
        telemetry
      });
    } catch (error) {
      if (error instanceof ProjectAutonomyError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }

      const message = error instanceof Error ? error.message : "Unable to trigger project run";
      app.log.error(error);
      return reply.code(message === "Project not found" ? 404 : 500).send({
        error: message === "Project not found" ? "project_not_found" : "internal_error",
        message
      });
    }
  });

  app.post("/projects", async (request, reply) => {
    const parsedBody = parseProjectRegistrationBody(request.body);
    if (!parsedBody.input) {
      return reply.code(400).send({
        error: "validation_error",
        message: parsedBody.error ?? "Invalid project registration body"
      });
    }

    try {
      const project = await registerProject(parsedBody.input);
      return reply.code(201).send({ project });
    } catch (error) {
      if (error instanceof RepositoryPathError) {
        return reply.code(400).send({
          error: "repository_path_invalid",
          message: error.message
        });
      }

      if (error instanceof ProjectRegistrationError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }

      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
      message: "Unable to register project"
      });
    }
  });

  app.post("/projects/:projectId/plan", async (request, reply) => {
    const { projectId } = request.params as { projectId?: string };
    if (!projectId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "projectId is required"
      });
    }

    try {
      const project = await planProject(projectId);
      if (!project) {
        return reply.code(404).send({
          error: "project_not_found",
          message: "Project not found"
        });
      }

      return reply.code(201).send({ project });
    } catch (error) {
      if (error instanceof RepositoryPathError) {
        return reply.code(400).send({
          error: "repository_path_invalid",
          message: error.message
        });
      }

      app.log.error(error);
      return reply.code(503).send({
        error: "planning_unavailable",
        message: "Unable to build a plan for this project"
      });
    }
  });

  app.post("/projects/:projectId/tasks/:taskId/dispatch", async (request, reply) => {
    const { projectId, taskId } = request.params as { projectId?: string; taskId?: string };
    if (!projectId || !taskId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "projectId and taskId are required"
      });
    }

    try {
      const result = await dispatchTask(projectId, taskId);
      return reply.code(202).send(result);
    } catch (error) {
      if (error instanceof ProjectDispatchError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }

      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to dispatch task"
      });
    }
  });

  app.post("/projects/:projectId/jobs/:jobId/pull-request", async (request, reply) => {
    const { projectId, jobId } = request.params as { projectId?: string; jobId?: string };
    if (!projectId || !jobId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "projectId and jobId are required"
      });
    }

    try {
      const result = await createProjectPullRequest(projectId, jobId);
      return reply.code(result.created ? 201 : 200).send(result);
    } catch (error) {
      if (error instanceof ProjectPullRequestError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }

      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to create a pull request for this job"
      });
    }
  });

  app.get("/projects/:projectId/jobs/:jobId/log", async (request, reply) => {
    const { projectId, jobId } = request.params as { projectId?: string; jobId?: string };
    if (!projectId || !jobId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "projectId and jobId are required"
      });
    }

    try {
      const log = await readProjectJobLog(projectId, jobId);
      return reply.code(200).send({ log });
    } catch (error) {
      if (error instanceof ProjectJobLogError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }

      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to load the job log"
      });
    }
  });

  app.post("/projects/:projectId/jobs/:jobId/refresh", async (request, reply) => {
    const { projectId, jobId } = request.params as { projectId?: string; jobId?: string };
    if (!projectId || !jobId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "projectId and jobId are required"
      });
    }

    try {
      const result = await refreshProjectJob(projectId, jobId);
      return reply.code(200).send(result);
    } catch (error) {
      if (error instanceof ProjectJobRefreshError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }

      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to refresh the job"
      });
    }
  });

  app.post("/projects/:projectId/jobs/refresh-active", async (request, reply) => {
    const { projectId } = request.params as { projectId?: string };
    if (!projectId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "projectId is required"
      });
    }

    try {
      const result = await refreshProjectActiveJobs(projectId);
      return reply.code(200).send(result);
    } catch (error) {
      if (error instanceof ProjectJobRefreshError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }

      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to refresh active jobs"
      });
    }
  });

  app.post("/projects/:projectId/advance", async (request, reply) => {
    const { projectId } = request.params as { projectId?: string };
    if (!projectId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "projectId is required"
      });
    }

    try {
      const result = await advanceProject(projectId);
      return reply.code(202).send(result);
    } catch (error) {
      if (error instanceof ProjectDispatchError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }

      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to advance project"
      });
    }
  });

  app.post("/projects/:projectId/blockers/:blockerId/resolve", async (request, reply) => {
    const { projectId, blockerId } = request.params as { projectId?: string; blockerId?: string };
    if (!projectId || !blockerId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "projectId and blockerId are required"
      });
    }

    try {
      const result = await resolveProjectBlocker(projectId, blockerId);
      const run = await triggerProjectRunIfEnabled(projectId);
      return reply.code(200).send({
        ...result,
        ...run
      });
    } catch (error) {
      if (error instanceof ProjectBlockerError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }

      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to resolve blocker"
      });
    }
  });

  app.post("/projects/:projectId/blockers/:blockerId/approval", async (request, reply) => {
    const { projectId, blockerId } = request.params as { projectId?: string; blockerId?: string };
    if (!projectId || !blockerId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "projectId and blockerId are required"
      });
    }

    const parsedBody = parseProjectApprovalBody(request.body);
    if (!parsedBody.input) {
      return reply.code(400).send({
        error: "validation_error",
        message: parsedBody.error ?? "Invalid blocker approval body"
      });
    }

    try {
      const result = await applyProjectBlockerApproval(projectId, blockerId, parsedBody.input.action);
      const run = await triggerProjectRunIfEnabled(projectId);
      return reply.code(200).send({
        ...result,
        ...run
      });
    } catch (error) {
      if (error instanceof ProjectApprovalError || error instanceof ProjectBlockerError || error instanceof ProjectPullRequestError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }

      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to apply blocker approval"
      });
    }
  });

  app.post("/projects/:projectId/blockers/:blockerId/github-issue", async (request, reply) => {
    const { projectId, blockerId } = request.params as { projectId?: string; blockerId?: string };
    if (!projectId || !blockerId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "projectId and blockerId are required"
      });
    }

    try {
      const result = await createProjectBlockerGitHubIssue(projectId, blockerId);
      return reply.code(200).send(result);
    } catch (error) {
      if (error instanceof ProjectGitHubIssueError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }

      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
      message: "Unable to create GitHub issue"
      });
    }
  });

  app.put("/projects/:projectId/roles", async (request, reply) => {
    const { projectId } = request.params as { projectId?: string };
    if (!projectId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "projectId is required"
      });
    }

    const parsedBody = parseProjectRoleDefinitionsBody(request.body);
    if (!parsedBody.input) {
      return reply.code(400).send({
        error: "validation_error",
        message: parsedBody.error ?? "Invalid project role definitions body"
      });
    }

    try {
      const project = await replaceProjectRoleDefinitions(projectId, parsedBody.input);
      const run = await triggerProjectRunIfEnabled(projectId);
      return reply.code(200).send({ project, ...run });
    } catch (error) {
      if (error instanceof ProjectRoleDefinitionError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }

      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to update project role definitions"
      });
    }
  });

  app.post("/projects/:projectId/messages", async (request, reply) => {
    const { projectId } = request.params as { projectId?: string };
    if (!projectId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "projectId is required"
      });
    }

    const parsedBody = parseProjectMessageBody(request.body);
    if (!parsedBody.input) {
      return reply.code(400).send({
        error: "validation_error",
        message: parsedBody.error ?? "Invalid message body"
      });
    }

    try {
      const message = await createProjectMessage(projectId, parsedBody.input);
      const run = await triggerProjectRunIfEnabled(projectId);

      return reply.code(201).send({
        message,
        ...run
      });
    } catch (error) {
      if (error instanceof ProjectRegistrationError || error instanceof ProjectRoleDefinitionError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }

      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to create project message"
      });
    }
  });
};
