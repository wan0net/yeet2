import { apiFetch } from "./api";

async function extractError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string; error?: string; detail?: string };
    return payload.detail || payload.message || payload.error || `Request failed: ${response.status}`;
  } catch {
    return `Request failed: ${response.status}`;
  }
}

export async function postJson(path: string, body: unknown): Promise<unknown> {
  const response = await apiFetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await extractError(response));
  }

  return response.json().catch(() => null);
}

export async function putJson(path: string, body: unknown): Promise<unknown> {
  const response = await apiFetch(path, {
    method: "PUT",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await extractError(response));
  }

  return response.json().catch(() => null);
}
