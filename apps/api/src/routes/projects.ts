import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import { RepositoryPathError } from "../constitution";
import {
  dispatchTask,
  getRegisteredProject,
  listRegisteredProjects,
  registerProject,
  planProject,
  ProjectDispatchError,
  type ProjectRegistrationInput
} from "../projects";

function parseProjectRegistrationBody(body: unknown): ProjectRegistrationInput | null {
  if (typeof body !== "object" || body === null) {
    return null;
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

  if (!name || !repoUrl || !defaultBranch || !localPath) {
    return null;
  }

  return {
    name,
    repoUrl,
    defaultBranch,
    localPath
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
    const body = parseProjectRegistrationBody(request.body);
    if (body === null) {
      return reply.code(400).send({
        error: "validation_error",
        message: "name, repoUrl, defaultBranch, and localPath are required"
      });
    }

    try {
      const project = await registerProject(body);
      return reply.code(201).send({ project });
    } catch (error) {
      if (error instanceof RepositoryPathError) {
        return reply.code(400).send({
          error: "repository_path_invalid",
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
};
