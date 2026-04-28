import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";

import type { AutonomyLoopManager } from "../autonomy-loop";
import { describeApiAuth, matchesBearerToken, parseAuthorizationHeader, readConfiguredApiToken } from "../auth";
import { buildControlPlaneOverview } from "../overview";
import { createProjectMessage, getRegisteredProject, listRegisteredProjects, ProjectRoleDefinitionError, type ProjectSummary } from "../projects";

function readConfiguredHermesToken(): string | null {
  const token = (process.env.YEET2_HERMES_BEARER_TOKEN ?? "").trim();
  return token || null;
}

function listAcceptedHermesTokens(): string[] {
  return [...new Set([readConfiguredHermesToken(), readConfiguredApiToken()].filter((value): value is string => Boolean(value)))];
}

async function requireHermesAuth(request: FastifyRequest, reply: import("fastify").FastifyReply): Promise<void> {
  const acceptedTokens = listAcceptedHermesTokens();
  if (acceptedTokens.length === 0) {
    return;
  }

  const receivedToken = parseAuthorizationHeader(request);
  if (acceptedTokens.some((token) => matchesBearerToken(receivedToken, token))) {
    return;
  }

  await reply.code(401).send({
    error: "unauthorized",
    message: "A valid bearer token is required for Hermes integration routes."
  });
}

function toHermesProjectSummary(summary: ProjectSummary) {
  return {
    id: summary.id,
    name: summary.name,
    autonomyMode: summary.autonomyMode ?? "manual",
    constitutionStatus: summary.constitutionStatus,
    activeMissionCount: summary.activeMissionCount,
    activeTaskCount: summary.activeTaskCount,
    blockerCount: summary.blockerCount,
    nextDispatchableTaskId: summary.nextDispatchableTaskId ?? null,
    nextDispatchableTaskRole: summary.nextDispatchableTaskRole ?? null,
    lastAutonomyRunAt: summary.lastAutonomyRunAt ?? null,
    lastAutonomyStatus: summary.lastAutonomyStatus ?? null,
    lastAutonomyMessage: summary.lastAutonomyMessage ?? null,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt
  };
}

function countValues(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function parseHermesTriggerBody(body: unknown): {
  input: { content: string | null; actor: string | null; replyToId: string | null } | null;
  error: string | null;
} {
  if (body === null || body === undefined) {
    return {
      input: {
        content: null,
        actor: "hermes",
        replyToId: null
      },
      error: null
    };
  }

  if (typeof body !== "object") {
    return {
      input: null,
      error: "Request body must be an object"
    };
  }

  const candidate = body as Record<string, unknown>;

  if (candidate.content !== undefined && typeof candidate.content !== "string") {
    return {
      input: null,
      error: "content must be a string"
    };
  }

  if (candidate.actor !== undefined && typeof candidate.actor !== "string") {
    return {
      input: null,
      error: "actor must be a string"
    };
  }

  if (candidate.replyToId !== undefined && typeof candidate.replyToId !== "string") {
    return {
      input: null,
      error: "replyToId must be a string"
    };
  }

  const content = typeof candidate.content === "string" ? candidate.content.trim() : "";
  const actor = typeof candidate.actor === "string" ? candidate.actor.trim() : "hermes";
  const replyToId = typeof candidate.replyToId === "string" ? candidate.replyToId.trim() : "";

  return {
    input: {
      content: content || null,
      actor: actor || "hermes",
      replyToId: replyToId || null
    },
    error: null
  };
}

export const registerHermesRoutes: FastifyPluginAsync<{ loopManager: AutonomyLoopManager }> = async (
  app: FastifyInstance,
  options
) => {
  app.addHook("onRequest", requireHermesAuth);

  app.get("/integrations/hermes/stats", async (_request, reply) => {
    try {
      const [overview, projects] = await Promise.all([buildControlPlaneOverview(), listRegisteredProjects()]);

      return reply.code(200).send({
        generatedAt: overview.generatedAt,
        auth: {
          api: describeApiAuth(),
          hermes: {
            enabled: Boolean(readConfiguredHermesToken())
          }
        },
        overview,
        projects: {
          total: projects.projects.length,
          byAutonomyMode: countValues(projects.projects.map((entry) => entry.autonomyMode ?? "manual")),
          byConstitutionStatus: countValues(projects.projects.map((entry) => entry.constitutionStatus))
        }
      });
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to load Hermes integration stats"
      });
    }
  });

  app.get("/integrations/hermes/projects", async (_request, reply) => {
    try {
      const projects = await listRegisteredProjects();
      return reply.code(200).send({
        projects: projects.projects.map(toHermesProjectSummary)
      });
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to load Hermes integration projects"
      });
    }
  });

  app.get("/integrations/hermes/projects/:projectId", async (request, reply) => {
    const { projectId } = request.params as { projectId?: string };
    if (!projectId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "projectId is required"
      });
    }

    try {
      const project = await getRegisteredProject(projectId);
      if (!project.project) {
        return reply.code(404).send({
          error: "project_not_found",
          message: "Project not found"
        });
      }

      return reply.code(200).send(project);
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to load Hermes integration project"
      });
    }
  });

  app.post("/integrations/hermes/projects/:projectId/trigger", async (request, reply) => {
    const { projectId } = request.params as { projectId?: string };
    if (!projectId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "projectId is required"
      });
    }

    const parsedBody = parseHermesTriggerBody(request.body);
    if (!parsedBody.input) {
      return reply.code(400).send({
        error: "validation_error",
        message: parsedBody.error ?? "Invalid Hermes trigger body"
      });
    }

    try {
      const message = parsedBody.input.content
        ? await createProjectMessage(projectId, {
            content: parsedBody.input.content,
            actor: parsedBody.input.actor,
            replyToId: parsedBody.input.replyToId
          })
        : null;

      const telemetry = await options.loopManager.triggerProject(projectId);
      const project = await getRegisteredProject(projectId);
      if (!project.project) {
        return reply.code(404).send({
          error: "project_not_found",
          message: "Project not found"
        });
      }

      return reply.code(200).send({
        project: project.project,
        telemetry,
        ...(message ? { message } : {})
      });
    } catch (error) {
      if (error instanceof ProjectRoleDefinitionError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }

      app.log.error({ error, projectId }, "Hermes project trigger failed");
      const isNotFound = error instanceof Error && error.message === "Project not found";
      return reply.code(isNotFound ? 404 : 500).send({
        error: isNotFound ? "project_not_found" : "internal_error",
        message: isNotFound ? "Project not found" : "Unable to trigger Hermes project run"
      });
    }
  });
};
