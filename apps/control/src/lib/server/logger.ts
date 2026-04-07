/**
 * Minimal server-side logger for Control. Used by load() helpers that
 * previously swallowed errors silently with `catch { return [] }`, which
 * made API outages invisible to operators looking at server logs.
 *
 * Writes JSON lines to stderr so container log collectors can ingest them
 * without format heuristics.
 */

type LogLevel = "warn" | "error";

function emit(level: LogLevel, message: string, context: Record<string, unknown>): void {
  const entry = {
    level,
    time: new Date().toISOString(),
    service: "control",
    message,
    ...context
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.warn(line);
  }
}

function normalizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      error: {
        name: error.name,
        message: error.message
      }
    };
  }
  return { error: { value: String(error) } };
}

export const serverLogger = {
  warn(message: string, context: Record<string, unknown> = {}): void {
    emit("warn", message, context);
  },
  error(message: string, context: Record<string, unknown> = {}): void {
    emit("error", message, context);
  },
  /** Log a failure from a load() helper where we're returning an empty
   * fallback so the page can still render. */
  loadFailure(operation: string, error: unknown, context: Record<string, unknown> = {}): void {
    emit("warn", `load helper failed: ${operation}`, {
      ...context,
      ...normalizeError(error)
    });
  }
};
