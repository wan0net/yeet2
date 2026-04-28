# Hermes Agent Integration

This guide defines the first yeet2 integration contract for Hermes Agent.

Use it when Hermes needs to:

- poll fleet-level stats
- list projects and inspect a project
- inject operator guidance into a project
- trigger the autonomy loop for a project

## Auth

Hermes routes live under `/integrations/hermes/*`.

They accept:

- `YEET2_HERMES_BEARER_TOKEN` when configured
- or `YEET2_API_BEARER_TOKEN` as a fallback when the Hermes token is blank

Example:

```bash
curl -H "Authorization: Bearer $YEET2_HERMES_BEARER_TOKEN" \
  http://localhost:3001/integrations/hermes/stats
```

## Endpoints

### `GET /integrations/hermes/stats`

Returns a compact fleet snapshot for polling dashboards and routing logic.

Use it for:

- health checks
- high-level queue pressure
- project-count and autonomy-mode summaries

### `GET /integrations/hermes/projects`

Returns compact project summaries:

- identity
- autonomy mode
- constitution status
- active mission/task counts
- blocker count
- last autonomy status/message

Use it to decide which project Hermes should inspect or trigger next.

### `GET /integrations/hermes/projects/:projectId`

Returns the full project detail payload already used by the Control plane.

Use it when Hermes needs mission, task, blocker, or decision-log detail before acting.

### `POST /integrations/hermes/projects/:projectId/trigger`

Triggers a project run immediately.

Optional request body:

```json
{
  "content": "Please prioritise the next ready task and report blockers clearly.",
  "actor": "hermes-agent",
  "replyToId": "optional-message-id"
}
```

If `content` is present, yeet2 stores it as a project chat/operator message before the run is triggered.

Response includes:

- `project`
- `telemetry`
- optional `message`

## Recommended Hermes Flow

1. Poll `GET /integrations/hermes/stats` every 15-60 seconds.
2. If queue pressure or blockers look interesting, call `GET /integrations/hermes/projects`.
3. Fetch `GET /integrations/hermes/projects/:projectId` only for the project Hermes wants to reason about.
4. When Hermes has operator guidance or wants to wake the loop, call `POST /integrations/hermes/projects/:projectId/trigger`.

That keeps Hermes cheap and avoids repeatedly pulling full project payloads.

## TypeScript Client

`@yeet2/domain` now exports a small typed client helper:

```ts
import { createHermesClient } from "@yeet2/domain";

const hermes = createHermesClient({
  baseUrl: "http://127.0.0.1:3001",
  bearerToken: process.env.YEET2_HERMES_BEARER_TOKEN
});

const stats = await hermes.getStats();
const projects = await hermes.listProjects();

if (projects.projects.length > 0) {
  const projectId = projects.projects[0].id;
  const detail = await hermes.getProject(projectId);

  if (detail.project?.nextDispatchableTaskId || detail.project?.blockerCount) {
    await hermes.triggerProject(projectId, {
      actor: "hermes-agent",
      content: "Review the current state and continue work if policy allows."
    });
  }
}
```

## Contract Notes

- Hermes stats are intentionally compact and aggregation-oriented.
- Full project detail is still available, but only on the project-specific route.
- Trigger calls are idempotent enough for operator use, but Hermes should avoid hot-looping them.
- If a project is in `manual` autonomy mode, the trigger still returns telemetry, but the run outcome will usually be `skipped`.
