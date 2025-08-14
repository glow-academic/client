import { sql } from "@/utils/drizzle/db";
import { NextResponse } from "next/server";

type LogEntryPayload = {
  event?: string;
  level?: "debug" | "info" | "warn" | "error";
  message?: string;
  correlation?: {
    correlationId?: string;
    requestId?: string;
    sessionId?: string;
    attemptId?: string;
    chatId?: string;
  };
  actor?: Record<string, unknown>;
  subject?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  context?: Record<string, unknown>;
  error?: unknown;
};

type JSONPrimitive = string | number | boolean | null;
type JSONValue = JSONPrimitive | { [key: string]: JSONValue } | JSONValue[];

function ensureJson(value: unknown): JSONValue | null {
  try {
    // stringify to ensure removals of non-serializable structures
    return JSON.parse(JSON.stringify(value)) as JSONValue;
  } catch {
    return null;
  }
}

// We import server transport lazily to keep client bundle clean
async function logToDatabase(entry: LogEntryPayload) {
  // ✅ Use the imported, shared 'sql' instance directly instead of creating a new connection
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
  } = entry ?? {};

  // Pre-compute JSON values to avoid issues with IIFEs in SQL template
  const actorJson = ensureJson(actor);
  const subjectJson = ensureJson(subject);
  const metricsJson = ensureJson(metrics);
  const contextJson = ensureJson(context);
  const errorJson = ensureJson(error);

  await sql`
    INSERT INTO app_logs (
      event, level, message, correlation_id, actor, subject, metrics, context, error, created_at
    ) VALUES (
      ${event ?? "legacy.message"}, ${level ?? "info"}, ${message ?? null}, ${correlation?.correlationId ?? null},
      ${actorJson ? JSON.stringify(actorJson) : null},
      ${subjectJson ? JSON.stringify(subjectJson) : null},
      ${metricsJson ? JSON.stringify(metricsJson) : null},
      ${contextJson ? JSON.stringify(contextJson) : null},
      ${errorJson ? JSON.stringify(errorJson) : null},
      ${new Date().toISOString()}
    )
  `;
}

export async function POST(req: Request) {
  try {
    const entry = (await req.json()) as unknown as LogEntryPayload;
    // Very light validation to avoid runtime crashes, full zod schema can be added later
    if (!entry || typeof entry !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid payload" },
        { status: 400 }
      );
    }
    await logToDatabase(entry);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
