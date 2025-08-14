// Isomorphic structured logger that works in both client and server environments.
// - Client: POSTs to /api/log (sendBeacon when available)
// - Server: Writes directly to Postgres

type LogLevel = "debug" | "info" | "warn" | "error";

// Keep event name open for now; we will tighten this to a union incrementally
type LogEventName = string;

type LogActor = { userId?: string; profileId?: string };
type LogSubject = { entityType?: string; entityId?: string };
type LogCorrelation = {
  correlationId?: string;
  requestId?: string;
  sessionId?: string;
  attemptId?: string;
  chatId?: string;
};
type LogMetrics = { durationMs?: number; size?: number; count?: number };
type LogError = {
  name?: string;
  message?: string;
  stack?: string;
  code?: string;
};
type LogContext = {
  route?: string;
  component?: string;
  function?: string;
  provider?: string;
  model?: string;
} & Record<string, unknown>;

export type LogEntry = {
  event: LogEventName;
  level: LogLevel;
  message?: string;
  correlation?: LogCorrelation;
  actor?: LogActor;
  subject?: LogSubject;
  metrics?: LogMetrics;
  context?: LogContext;
  error?: LogError | unknown;
};

const isProduction = process.env.NODE_ENV === "production";

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return "<unserializable>";
  }
}

function generateCorrelationId(): string {
  try {
    // Browser or Node 18+
    const g = (globalThis as any).crypto?.randomUUID;
    if (typeof g === "function") return g();
  } catch (_) {
    // ignore
  }
  return `cor_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

// Legacy normalizer removed along with shim functions

// Note: We intentionally avoid any server-only imports (like "postgres") here to keep
// this module safe to import from client bundles. All logs are sent to the server
// via the /api/log route; the route writes to Postgres.

// --- Client transport ---
async function sendClientLog(entry: LogEntry): Promise<void> {
  const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";
  const logUrl = `${appPrefix}/api/log`;

  try {
    const body = safeStringify(entry);
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const ok = navigator.sendBeacon(
        logUrl,
        new Blob([body], { type: "application/json" })
      );
      if (ok) return;
    }
  } catch (_) {
    // fallthrough to fetch
  }

  // Use absolute URL for fetch to avoid URL parsing issues
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const absoluteLogUrl = `${baseUrl}${logUrl}`;

  await fetch(absoluteLogUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
    keepalive: true,
    credentials: "same-origin",
  });
}

type Transport = (entry: LogEntry) => Promise<void>;

// Use a single transport that always posts to our server route. On the client, we
// prefer sendBeacon when available; on the server, we fall back to fetch.
const transport: Transport = sendClientLog;

export const log = {
  async event(entry: LogEntry): Promise<void> {
    // Console echo in non-production to aid dev UX
    if (!isProduction) {
      const label = `[${entry.level}] ${entry.event}`;
      // eslint-disable-next-line no-console
      (console as any)[entry.level === "error" ? "error" : entry.level](
        label,
        entry
      );
    }
    const withCorr = {
      correlation: {
        correlationId:
          entry.correlation?.correlationId ?? generateCorrelationId(),
        ...entry.correlation,
      },
      ...entry,
    } satisfies LogEntry;
    return transport(withCorr);
  },
  async info(event: LogEventName, rest: Omit<LogEntry, "event" | "level">) {
    return this.event({ event, level: "info", ...rest });
  },
  async warn(event: LogEventName, rest: Omit<LogEntry, "event" | "level">) {
    return this.event({ event, level: "warn", ...rest });
  },
  async debug(event: LogEventName, rest: Omit<LogEntry, "event" | "level">) {
    // Optionally drop/sampling in prod later
    return this.event({ event, level: "debug", ...rest });
  },
  async error(event: LogEventName, rest: Omit<LogEntry, "event" | "level">) {
    return this.event({ event, level: "error", ...rest });
  },
};

// Backwards-compatibility shims removed

// Optional helper for timings
export async function withDuration<T>(
  fn: () => Promise<T>
): Promise<[T, number]> {
  const start =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const result = await fn();
  const end =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  return [result, end - start];
}
