import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function apiBaseUrl(): string {
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

function parseAction(payload: unknown): "approve" | "reject" | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const action = typeof candidate.action === "string" ? candidate.action.trim().toLowerCase() : "";
  return action === "approve" || action === "reject" ? action : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; blockerId: string }> }) {
  const resolvedParams = await params;
  const projectId = resolvedParams.id?.trim();
  const blockerId = resolvedParams.blockerId?.trim();

  if (!projectId || !blockerId) {
    return NextResponse.json(
      {
        error: "validation_error",
        message: "project id and blocker id are required"
      },
      { status: 400 }
    );
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "invalid_json",
        message: "Request body must be valid JSON"
      },
      { status: 400 }
    );
  }

  const action = parseAction(body);
  if (!action) {
    return NextResponse.json(
      {
        error: "validation_error",
        message: 'action must be "approve" or "reject"'
      },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(upstreamUrl(`/projects/${projectId}/blockers/${blockerId}/approval`), {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action })
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

    return NextResponse.json(payload ?? { action }, { status: 200 });
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
