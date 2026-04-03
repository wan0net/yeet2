import { NextResponse } from "next/server";

import { normalizeWorkerList } from "../../../lib/workers";

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

export async function GET() {
  try {
    const response = await fetch(upstreamUrl("/workers"), {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });
    const payload = await readJsonResponse(response);
    const workers = normalizeWorkerList(payload);

    return NextResponse.json(
      {
        workers,
        registryAvailable: response.ok,
        upstreamStatus: response.status,
        error: response.ok ? null : "upstream_error",
        detail: response.ok ? null : payload
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        workers: [],
        registryAvailable: false,
        upstreamStatus: null,
        error: "api_unavailable",
        detail: error instanceof Error ? error.message : "Unable to reach the API service"
      },
      { status: 200 }
    );
  }
}
