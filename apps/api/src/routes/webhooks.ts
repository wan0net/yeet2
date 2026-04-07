import crypto from "node:crypto";

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";

import { prisma } from "../db";
import { recordDecisionLog } from "../decision-logs";

// Augment request type to carry the raw body buffer for HMAC verification.
declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

export const registerWebhookRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Override JSON parsing within this plugin scope to capture the raw bytes.
  // HMAC-SHA256 must be computed over the exact bytes GitHub sent, not re-serialised JSON.
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, function (req: FastifyRequest, rawBody: Buffer, done) {
    req.rawBody = rawBody;
    try {
      done(null, JSON.parse(rawBody.toString("utf-8")));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // In-memory dedup of recent X-GitHub-Delivery IDs. GitHub re-delivers
  // failed webhooks; we ack 200 once we record them, so we shouldn't process
  // the same delivery twice. Map: deliveryId -> insertion timestamp (ms).
  const recentDeliveries = new Map<string, number>();
  const DELIVERY_DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

  function pruneDeliveries(now: number): void {
    for (const [id, timestamp] of recentDeliveries) {
      if (now - timestamp > DELIVERY_DEDUP_WINDOW_MS) {
        recentDeliveries.delete(id);
      }
    }
  }

  app.post("/webhooks/github", async (request, reply) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    // Refuse webhooks entirely if no secret is configured. The previous
    // behaviour fell through to no-auth, allowing anyone on the network to
    // forge audit log entries.
    if (!secret) {
      return reply.code(503).send({
        error: "webhook_not_configured",
        message: "GITHUB_WEBHOOK_SECRET must be set to receive webhooks"
      });
    }

    const signatureHeader = (request.headers["x-hub-signature-256"] as string) ?? "";
    const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(request.body));
    const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;

    let valid = false;
    try {
      valid = crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
    } catch {
      valid = false;
    }

    if (!valid) {
      return reply.code(401).send({ error: "invalid_signature" });
    }

    // Replay protection: dedup by X-GitHub-Delivery within a 10-minute window.
    const deliveryId = (request.headers["x-github-delivery"] as string) ?? "";
    if (deliveryId) {
      const now = Date.now();
      pruneDeliveries(now);
      if (recentDeliveries.has(deliveryId)) {
        return reply.code(200).send({ ok: true, deduped: true });
      }
      recentDeliveries.set(deliveryId, now);
    }

    const event = (request.headers["x-github-event"] as string) ?? "unknown";
    const body = request.body as Record<string, unknown>;

    try {
      if (event === "push") {
        const ref = (body.ref as string) ?? "unknown";
        const pusher = (body.pusher as Record<string, unknown>) ?? {};
        const pusherName = (pusher.name as string) ?? "unknown";
        const repository = (body.repository as Record<string, unknown>) ?? {};
        const fullName = (repository.full_name as string) ?? "";
        const [owner, repo] = fullName.split("/");

        let projectId: string | undefined;
        if (owner && repo) {
          const project = await prisma.project.findFirst({ where: { githubRepoOwner: owner, githubRepoName: repo } });
          projectId = project?.id;
        }

        if (projectId) {
          await recordDecisionLog({
            projectId,
            kind: "webhook",
            actor: "github",
            summary: `Push to ${ref} by ${pusherName}`
          });
        }
      } else if (event === "pull_request") {
        const number = (body.number as number) ?? 0;
        const action = (body.action as string) ?? "unknown";
        const sender = (body.sender as Record<string, unknown>) ?? {};
        const senderLogin = (sender.login as string) ?? "unknown";
        const repository = (body.repository as Record<string, unknown>) ?? {};
        const fullName = (repository.full_name as string) ?? "";
        const [owner, repo] = fullName.split("/");

        let projectId: string | undefined;
        if (owner && repo) {
          const project = await prisma.project.findFirst({ where: { githubRepoOwner: owner, githubRepoName: repo } });
          projectId = project?.id;
        }

        if (projectId) {
          await recordDecisionLog({
            projectId,
            kind: "webhook",
            actor: "github",
            summary: `PR #${number} ${action} by ${senderLogin}`
          });
        }
      } else if (event === "issues") {
        const number = (body.number as number) ?? 0;
        const action = (body.action as string) ?? "unknown";
        const sender = (body.sender as Record<string, unknown>) ?? {};
        const senderLogin = (sender.login as string) ?? "unknown";
        const repository = (body.repository as Record<string, unknown>) ?? {};
        const fullName = (repository.full_name as string) ?? "";
        const [owner, repo] = fullName.split("/");

        let projectId: string | undefined;
        if (owner && repo) {
          const project = await prisma.project.findFirst({ where: { githubRepoOwner: owner, githubRepoName: repo } });
          projectId = project?.id;
        }

        if (projectId) {
          await recordDecisionLog({
            projectId,
            kind: "webhook",
            actor: "github",
            summary: `Issue #${number} ${action} by ${senderLogin}`
          });
        }
      } else {
        app.log.info({ event }, "Unhandled GitHub webhook event");
      }
    } catch (err) {
      app.log.error({ err, event }, "Error processing GitHub webhook event");
    }

    return reply.code(200).send({ ok: true });
  });
};
