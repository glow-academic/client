// Server-only structured logger that writes directly to Postgres.
// Safe to import from server route handlers and server actions.

type LogLevel = "debug" | "info" | "warn" | "error";
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

type JSONPrimitive = string | number | boolean | null;
type JSONValue = JSONPrimitive | { [key: string]: JSONValue } | JSONValue[];

function ensureJson(value: unknown): JSONValue | null {
  try {
    // stringify/parse to strip non-serializable values
    return JSON.parse(JSON.stringify(value)) as JSONValue;
  } catch {
    return null;
  }
}

function generateCorrelationId(): string {
  try {
    const glb = globalThis as { crypto?: { randomUUID?: () => string } };
    const g = glb.crypto?.randomUUID;
    if (typeof g === "function") return g();
  } catch {}
  return `cor_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

async function insertStructuredLogToDatabase(entry: LogEntry): Promise<void> {
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
      ${actor ? sql.json(ensureJson(actor)) : null},
      ${subject ? sql.json(ensureJson(subject)) : null},
      ${metrics ? sql.json(ensureJson(metrics)) : null},
      ${context ? sql.json(ensureJson(context)) : null},
      ${
        error
          ? sql.json(
              ensureJson(
                error instanceof Error
                  ? {
                      name: error.name,
                      message: error.message,
                      stack: error.stack,
                    }
                  : (error as unknown)
              )
            )
          : null
      },
      ${new Date()}
    )
  `;
}

export const log = {
  async event(entry: LogEntry): Promise<void> {
    // Echo to console only in non-production to aid debugging. These are intentionally
    // ignored from lint as they are guarded by environment.
    if (!isProduction) {
      const label = `[${entry.level}] ${entry.event}`;
      const consoleMap: Record<
        LogLevel,
        (message?: unknown, ...optionalParams: unknown[]) => void
      > = {
        error: console.error, // eslint-disable-line no-console
        warn: console.warn, // eslint-disable-line no-console
        info: console.info, // eslint-disable-line no-console
        debug: console.debug, // eslint-disable-line no-console
      };
      const fn = consoleMap[entry.level] ?? console.debug; // eslint-disable-line no-console
      fn(label, entry);
    }
    const withCorr: LogEntry = {
      correlation: {
        correlationId:
          entry.correlation?.correlationId ?? generateCorrelationId(),
        ...entry.correlation,
      },
      ...entry,
    };
    try {
      await insertStructuredLogToDatabase(withCorr);
    } catch (err) {
      if (!isProduction) {
        // eslint-disable-next-line no-console
        console.error("Failed to insert log to database", err);
      }
    }
  },
  async info(event: LogEventName, rest: Omit<LogEntry, "event" | "level">) {
    return this.event({ event, level: "info", ...rest });
  },
  async warn(event: LogEventName, rest: Omit<LogEntry, "event" | "level">) {
    return this.event({ event, level: "warn", ...rest });
  },
  async debug(event: LogEventName, rest: Omit<LogEntry, "event" | "level">) {
    return this.event({ event, level: "debug", ...rest });
  },
  async error(event: LogEventName, rest: Omit<LogEntry, "event" | "level">) {
    return this.event({ event, level: "error", ...rest });
  },
};
