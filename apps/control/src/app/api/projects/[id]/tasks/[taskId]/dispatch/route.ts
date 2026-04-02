import { NextResponse } from "next/server";

import { normalizeProjectList, normalizeProjectRecord } from "../../../../../../../lib/projects";

export const dynamic = "force-dynamic";

function apiBaseUrl() {
  return (process.env.YEET2_API_BASE_URL ?? process.env.API_BASE_URL ?? "http://localhost:3001").replace(/\/+$/, "");
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function upstreamUrl(path: string): string {
  return `${apiBaseUrl()}${path}`;
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const resolvedParams = await params;
  const projectId = resolvedParams.id?.trim();
  const taskId = resolvedParams.taskId?.trim();

  if (!projectId || !taskId) {
    return NextResponse.json(
      {
        error: "validation_error",
        message: "project id and task id are required"
      },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(upstreamUrl(`/projects/${projectId}/tasks/${taskId}/dispatch`), {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "upstream_error",
          status: response.status,
          detail: payload
        },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    const project = normalizeProjectList(payload)[0] ?? normalizeProjectRecord(payload);

    if (!project) {
      return NextResponse.json(
        {
          error: "invalid_project_response"
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ project }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "api_unavailable",
        detail: error instanceof Error ? error.message : "Unable to reach the API service"
      },
      { status: 502 }
    );
  }
}
