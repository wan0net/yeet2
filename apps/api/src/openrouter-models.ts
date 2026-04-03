export interface OpenRouterModelCatalogItem {
  id: string;
  name: string;
  contextLength: number | null;
  description: string | null;
  provider: string | null;
  modality: string | null;
  inputModalities: string[];
  outputModalities: string[];
  promptCostPerMillionUsd: number | null;
  completionCostPerMillionUsd: number | null;
  requestCostUsd: number | null;
}

export class OpenRouterModelCatalogError extends Error {
  constructor(
    public readonly code: "not_configured" | "upstream_error" | "invalid_response",
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "OpenRouterModelCatalogError";
  }
}

interface OpenRouterModelCatalogResponse {
  data?: unknown;
}

interface OpenRouterModelRecord {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  context_length?: unknown;
  pricing?: {
    prompt?: unknown;
    completion?: unknown;
    request?: unknown;
  };
  architecture?: {
    modality?: unknown;
    input_modalities?: unknown;
    output_modalities?: unknown;
  };
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAuthorization(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return /^bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

function readOpenRouterAuthorization(): string | null {
  const candidates = [
    process.env.OPENROUTER_API_KEY,
    process.env.OPENROUTER_AUTHORIZATION,
    process.env.OPENROUTER_BEARER_TOKEN,
    process.env.LLM_API_KEY,
    process.env.AUTHORIZATION
  ];

  for (const candidate of candidates) {
    const normalized = candidate ? normalizeAuthorization(candidate) : "";
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function isOpenRouterModelRecord(value: unknown): value is OpenRouterModelRecord {
  return typeof value === "object" && value !== null;
}

function toContextLength(record: OpenRouterModelRecord): number | null {
  return typeof record.context_length === "number" && Number.isFinite(record.context_length) ? Math.trunc(record.context_length) : null;
}

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
}

function toUsdPerMillionTokens(value: unknown): number | null {
  const perToken = toPositiveNumber(value);
  if (perToken === null) {
    return null;
  }

  return perToken * 1_000_000;
}

function toModelItem(record: OpenRouterModelRecord): OpenRouterModelCatalogItem {
  const id = cleanText(record.id);
  const name = cleanText(record.name);
  if (!id || !name) {
    throw new OpenRouterModelCatalogError("invalid_response", "OpenRouter returned a model without id or name.", 502);
  }

  const inputModalities = asStringArray(record.architecture?.input_modalities);
  const outputModalities = asStringArray(record.architecture?.output_modalities);
  const modality = cleanText(record.architecture?.modality) || (inputModalities.length || outputModalities.length ? `${inputModalities.join("+") || "unknown"}->${outputModalities.join("+") || "unknown"}` : "");

  return {
    id,
    name,
    contextLength: toContextLength(record),
    description: cleanText(record.description) || null,
    provider: id.includes("/") ? id.split("/", 1)[0]?.trim() || null : null,
    modality: modality || null,
    inputModalities,
    outputModalities,
    promptCostPerMillionUsd: toUsdPerMillionTokens(record.pricing?.prompt),
    completionCostPerMillionUsd: toUsdPerMillionTokens(record.pricing?.completion),
    requestCostUsd: toPositiveNumber(record.pricing?.request)
  };
}

export async function fetchOpenRouterModelCatalog(): Promise<OpenRouterModelCatalogItem[]> {
  const authorization = readOpenRouterAuthorization();
  if (!authorization) {
    throw new OpenRouterModelCatalogError(
      "not_configured",
      "OpenRouter is not configured. Set OPENROUTER_API_KEY or an Authorization-compatible env var such as OPENROUTER_AUTHORIZATION.",
      503
    );
  }

  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/models", {
      method: "GET",
      headers: {
        Authorization: authorization,
        Accept: "application/json"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    throw new OpenRouterModelCatalogError("upstream_error", `Unable to reach OpenRouter: ${message}`, 502);
  }

  const rawText = await response.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText) as OpenRouterModelCatalogResponse;
    } catch {
      throw new OpenRouterModelCatalogError("upstream_error", "OpenRouter returned invalid JSON.", 502);
    }
  }

  if (!response.ok) {
    const upstreamMessage =
      typeof parsed === "object" &&
      parsed !== null &&
      "error" in parsed &&
      typeof (parsed as Record<string, unknown>).error === "object" &&
      (parsed as Record<string, unknown>).error !== null &&
      "message" in ((parsed as Record<string, unknown>).error as Record<string, unknown>)
        ? String(((parsed as Record<string, unknown>).error as Record<string, unknown>).message)
        : typeof parsed === "object" && parsed !== null && "message" in parsed
          ? String((parsed as Record<string, unknown>).message)
          : response.statusText || "OpenRouter request failed";

    throw new OpenRouterModelCatalogError(
      "upstream_error",
      `OpenRouter request failed with status ${response.status}: ${upstreamMessage}`,
      502
    );
  }

  if (!parsed || typeof parsed !== "object" || !("data" in parsed) || !Array.isArray((parsed as OpenRouterModelCatalogResponse).data)) {
    throw new OpenRouterModelCatalogError("invalid_response", "OpenRouter returned an unexpected models payload.", 502);
  }

  const models = (parsed as { data: unknown[] }).data;
  const normalized = models.map((item: unknown) => {
    if (!isOpenRouterModelRecord(item)) {
      throw new OpenRouterModelCatalogError("invalid_response", "OpenRouter returned an invalid model entry.", 502);
    }

    return toModelItem(item);
  });

  return normalized.sort((left, right) => {
    const nameCompare = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    if (nameCompare !== 0) {
      return nameCompare;
    }

    return left.id.localeCompare(right.id, undefined, { sensitivity: "base" });
  });
}
