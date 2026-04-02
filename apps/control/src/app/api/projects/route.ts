import { NextResponse } from "next/server";

import {
  missingRegistrationFields,
  normalizeProjectList,
  normalizeProjectRegistration,
  normalizeProjectRecord
} from "../../../lib/projects";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("id")?.trim();

  try {
    const response = await fetch(upstreamUrl(projectId ? `/projects/${projectId}` : "/projects"), {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      const status = projectId && response.status === 404 ? 404 : 502;
      return NextResponse.json(
        {
          error: "upstream_error",
          status: response.status,
          detail: payload
        },
        { status }
      );
    }

    if (projectId) {
      const project = normalizeProjectList(payload)[0] ?? normalizeProjectRecord(payload);

      if (!project) {
        return NextResponse.json(
          {
            error: "invalid_project_response"
          },
          { status: 502 }
        );
      }

      return NextResponse.json({ project });
    }

    return NextResponse.json({ projects: normalizeProjectList(payload) });
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

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "invalid_json"
      },
      { status: 400 }
    );
  }

  const registration = normalizeProjectRegistration(payload);
  const missing = missingRegistrationFields(registration);

  if (!registration || missing.length > 0) {
    return NextResponse.json(
      {
        error: "validation_error",
        missing
      },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(upstreamUrl("/projects"), {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(registration)
    });
    const upstreamPayload = await readJsonResponse(response);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "upstream_error",
          status: response.status,
          detail: upstreamPayload
        },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    const project = normalizeProjectList(upstreamPayload)[0] ?? normalizeProjectRecord(upstreamPayload);
    if (!project) {
      return NextResponse.json(
        {
          error: "invalid_project_response"
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        project
      },
      { status: 201 }
    );
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
