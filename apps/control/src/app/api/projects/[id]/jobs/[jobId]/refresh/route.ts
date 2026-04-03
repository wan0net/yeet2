import { NextResponse } from "next/server";

import { controlBaseUrl } from "../../../../../../../lib/project-resource";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  const { id, jobId } = await params;
  const baseUrl = await controlBaseUrl();
  const response = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(id)}/jobs/${encodeURIComponent(jobId)}/refresh`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });

  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload, { status: response.status });
}
