function apiBaseUrl(): string {
  return (process.env.YEET2_API_URL || process.env.API_URL || "http://127.0.0.1:3001").replace(/\/+$/, "");
}

function apiHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("accept", "application/json");
  const token = process.env.YEET2_API_BEARER_TOKEN || process.env.YEET2_API_TOKEN;
  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }
  return headers;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: apiHeaders(init?.headers),
    cache: "no-store"
  });
}

export async function readApiError(response: Response): Promise<string> {
  const text = (await response.text()).trim();
  if (!text) {
    return `Request failed: ${response.status}`;
  }

  try {
    const payload = JSON.parse(text) as { message?: string; error?: string; detail?: string };
    return payload.detail || payload.message || payload.error || text;
  } catch {
    return text;
  }
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as T;
}
