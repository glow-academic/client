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

// --- Server transport (loaded lazily only on server) ---
async function insertStructuredLogToDatabase(entry: LogEntry): Promise<void> {
  // Lazy import to avoid bundling postgres in client
  const { db_url } = await import("@/utils/drizzle/db");
  const postgres = (await import("postgres")).default;
  const sql = db_url ? postgres(db_url) : null;
  if (!sql) throw new Error("PostgreSQL connection not available");

  const {
    event,
    level,
    message,
    correlation,
    actor,
    subject,
    metrics,
    context,
    error,
  } = entry;

  await sql`
    INSERT INTO app_logs (
      event, level, message, correlation_id, actor, subject, metrics, context, error, created_at
    ) VALUES (
      ${event}, ${level}, ${message ?? null}, ${correlation?.correlationId ?? null},
      ${actor ? sql.json(actor as any) : null},
      ${subject ? sql.json(subject as any) : null},
      ${metrics ? sql.json(metrics as any) : null},
      ${context ? sql.json(context as any) : null},
      ${
        error
          ? sql.json(
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                  }
                : (error as any)
            )
          : null
      },
      ${new Date()}
    )
  `;
}

// --- Client transport ---
async function sendClientLog(entry: LogEntry): Promise<void> {
  try {
    const body = safeStringify(entry);
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const ok = navigator.sendBeacon(
        "/api/log",
        new Blob([body], { type: "application/json" })
      );
      if (ok) return;
    }
  } catch (_) {
    // fallthrough to fetch
  }
  await fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
    keepalive: true,
    credentials: "same-origin",
  });
}

type Transport = (entry: LogEntry) => Promise<void>;

function getTransport(): Transport {
  if (typeof window === "undefined") {
    return insertStructuredLogToDatabase;
  }
  return sendClientLog;
}

const transport: Transport = getTransport();

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
