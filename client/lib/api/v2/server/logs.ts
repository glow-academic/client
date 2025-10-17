/**
 * Server-side logger for v2 API
 * Used in BFF routes and server actions
 * Flows through /api/v2/logs/create endpoint
 */

import { getApiBase } from "@/lib/api-base";

export type LogEntry = {
  event: string;
  level: "debug" | "info" | "warn" | "error";
  message?: string;
  correlation?: {
    correlationId?: string;
    requestId?: string;
    sessionId?: string;
    attemptId?: string;
    chatId?: string;
  };
  actor?: { userId?: string; profileId?: string };
  subject?: { entityType?: string; entityId?: string };
  metrics?: { durationMs?: number; size?: number; count?: number };
  context?: Record<string, unknown>;
  error?: unknown;
};

function devLog(level: LogEntry["level"], entry: LogEntry) {
  if (process.env.NODE_ENV !== "production") {
    const args = [
      `[${entry.level?.toUpperCase()}] ${entry.event}`,
      entry.message,
      entry,
    ];
    switch (level) {
      case "debug":
        // eslint-disable-next-line no-console
        console.debug(...args);
        break;
      case "info":
        // eslint-disable-next-line no-console
        console.info(...args);
        break;
      case "warn":
        // eslint-disable-next-line no-console
        console.warn(...args);
        break;
      case "error":
        // eslint-disable-next-line no-console
        console.error(...args);
        break;
      default:
        // eslint-disable-next-line no-console
        console.log(...args);
    }
  }
}

async function sendLog(entry: LogEntry): Promise<void> {
  devLog(entry.level, entry);
  try {
    await fetch(`${getApiBase()}/api/v2/logs/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(entry),
    });
  } catch (err) {
    // Fail silently in production, log in dev
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("Failed to send log", err);
    }
  }
}

export const log = {
  async info(event: string, rest: Omit<LogEntry, "event" | "level">) {
    return sendLog({ event, level: "info", ...rest });
  },
  async warn(event: string, rest: Omit<LogEntry, "event" | "level">) {
    return sendLog({ event, level: "warn", ...rest });
  },
  async error(event: string, rest: Omit<LogEntry, "event" | "level">) {
    return sendLog({ event, level: "error", ...rest });
  },
  async debug(event: string, rest: Omit<LogEntry, "event" | "level">) {
    return sendLog({ event, level: "debug", ...rest });
  },
};
