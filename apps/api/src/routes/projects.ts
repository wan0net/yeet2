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
import { fetchOpenRouterModelCatalog, OpenRouterModelCatalogError } from "../openrouter-models";
import {
  advanceProject,
  createProjectBlockerGitHubIssue,
  createProjectPullRequest,
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
  ProjectRoleDefinitionError,
  ProjectPullRequestError,
  replaceProjectRoleDefinitions,
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

function parseProjectRoleDefinitionsBody(body: unknown): { input: Array<{ roleKey: ProjectRoleKey; label: string; goal: string; backstory: string; model: string | null; enabled: boolean; sortOrder: number }> | null; error: string | null } {
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
      const label = typeof raw.label === "string" ? raw.label.trim() : "";
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

      if (!label || !goal || !backstory) {
        return null;
      }

      return {
        roleKey,
        label,
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
  app.get("/projects", async () => {
    return listRegisteredProjects();
  });

  app.get("/projects/models", async (_request, reply) => {
    try {
      const models = await fetchOpenRouterModelCatalog();
      return reply.code(200).send({ models });
    } catch (error) {
      if (error instanceof OpenRouterModelCatalogError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message
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

    const project = await getRegisteredProject(projectId);
    if (!project.project) {
      return reply.code(404).send({
        error: "project_not_found",
        message: "Project not found"
      });
    }

    return project;
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
      return reply.code(200).send({ project });
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
      return reply.code(200).send(result);
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
      return reply.code(200).send(result);
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
      return reply.code(200).send({ project });
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
};
