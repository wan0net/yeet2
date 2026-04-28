import { apiFetch, readApiError } from "./api";

export async function postJson(path: string, body: unknown): Promise<unknown> {
  const response = await apiFetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
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
    throw new Error(await readApiError(response));
  }

  return response.json().catch(() => null);
}

export async function deleteJson(path: string): Promise<unknown> {
  const response = await apiFetch(path, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.json().catch(() => null);
}
