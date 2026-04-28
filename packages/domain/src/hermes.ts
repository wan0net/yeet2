import type { ControlPlaneOverview, ProjectDecisionLogSummary, ProjectSummary } from "./index";

export interface HermesProjectSummary {
  id: string;
  name: string;
  autonomyMode: "manual" | "supervised" | "autonomous";
  constitutionStatus: string;
  activeMissionCount: number;
  activeTaskCount: number;
  blockerCount: number;
  nextDispatchableTaskId: string | null;
  nextDispatchableTaskRole: string | null;
  lastAutonomyRunAt: string | null;
  lastAutonomyStatus: string | null;
  lastAutonomyMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HermesIntegrationStats {
  generatedAt: string;
  auth: {
    api: {
      enabled: boolean;
      requireAuthForReads: boolean;
      mode: "open" | "write_protected" | "full";
    };
    hermes: {
      enabled: boolean;
    };
  };
  overview: ControlPlaneOverview;
  projects: {
    total: number;
    byAutonomyMode: Record<string, number>;
    byConstitutionStatus: Record<string, number>;
  };
}

export interface HermesProjectListResponse {
  projects: HermesProjectSummary[];
}

export interface HermesProjectDetailResponse {
  project: ProjectSummary | null;
}

export interface HermesProjectTriggerInput {
  content?: string;
  actor?: string;
  replyToId?: string;
}

export interface HermesProjectTriggerResponse {
  project: ProjectSummary;
  telemetry: {
    projectId: string;
    mode: "manual" | "supervised" | "autonomous";
    lastRunAt: string;
    lastAction: "plan" | "advance" | "pull_request" | "merge" | "skip" | "error";
    lastOutcome: "planned" | "advanced" | "created_pr" | "merged" | "merge_skipped" | "pr_skipped" | "skipped" | "idle" | "error";
    lastMissionId: string | null;
    lastTaskId: string | null;
    nextDispatchableTaskId: string | null;
    nextDispatchableTaskRole: string | null;
    activeMissionCount: number;
    activeTaskCount: number;
    message: string | null;
  };
  message?: ProjectDecisionLogSummary;
}

export interface HermesClientOptions {
  baseUrl: string;
  bearerToken?: string | null;
  fetch?: typeof fetch;
}

export class HermesClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null,
    public readonly detail: unknown
  ) {
    super(message);
    this.name = "HermesClientError";
  }
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

export function createHermesClient(options: HermesClientOptions) {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error("Fetch API is not available. Provide options.fetch explicitly.");
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers ?? {});
    if (!headers.has("accept")) {
      headers.set("accept", "application/json");
    }

    if (options.bearerToken && !headers.has("authorization")) {
      headers.set("authorization", `Bearer ${options.bearerToken}`);
    }

    const response = await fetchImpl(joinUrl(options.baseUrl, path), {
      ...init,
      headers
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).message === "string"
          ? ((payload as Record<string, unknown>).message as string)
          : `Hermes API request failed with status ${response.status}`;
      const code =
        payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).error === "string"
          ? ((payload as Record<string, unknown>).error as string)
          : null;
      throw new HermesClientError(message, response.status, code, payload);
    }

    return payload as T;
  }

  return {
    getStats(): Promise<HermesIntegrationStats> {
      return request<HermesIntegrationStats>("/integrations/hermes/stats");
    },

    listProjects(): Promise<HermesProjectListResponse> {
      return request<HermesProjectListResponse>("/integrations/hermes/projects");
    },

    getProject(projectId: string): Promise<HermesProjectDetailResponse> {
      return request<HermesProjectDetailResponse>(`/integrations/hermes/projects/${encodeURIComponent(projectId)}`);
    },

    triggerProject(projectId: string, input: HermesProjectTriggerInput = {}): Promise<HermesProjectTriggerResponse> {
      return request<HermesProjectTriggerResponse>(`/integrations/hermes/projects/${encodeURIComponent(projectId)}/trigger`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(input)
      });
    }
  };
}
