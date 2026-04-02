import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import { RepositoryPathError } from "../constitution";
import {
  advanceProject,
  createProjectBlockerGitHubIssue,
  dispatchTask,
  getRegisteredProject,
  listRegisteredProjects,
  registerProject,
  planProject,
  resolveProjectBlocker,
  ProjectBlockerError,
  ProjectDispatchError,
  ProjectGitHubIssueError,
  ProjectRegistrationError,
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

export const registerProjectRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/projects", async () => {
    return listRegisteredProjects();
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
};
