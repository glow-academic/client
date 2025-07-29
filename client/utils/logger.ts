"use server";
// This file should only be imported on the server side
import { db_url } from "@/utils/drizzle/db";
import postgres from "postgres";

// Server-only PostgreSQL logger, log to console in non production
const isProduction = process.env.NODE_ENV === "production";

let sql: postgres.Sql | null = null;

// Initialize PostgreSQL connection
function initializePostgres() {
  if (!sql && db_url) {
    sql = postgres(db_url);
  }
  return sql;
}

// Direct PostgreSQL logging function
async function insertLogToDatabase(
  level: string,
  message: string,
  context: Record<string, unknown>,
): Promise<void> {
  try {
    const pgSql = initializePostgres();
    if (!pgSql) {
      throw new Error("PostgreSQL connection not available");
    }

    await pgSql`
      INSERT INTO app_logs (level, message, context, created_at)
      VALUES (${level}, ${message}, ${JSON.stringify(context)}, ${new Date()})
    `;
  } catch (error) {
    throw new Error(`Failed to insert log to database: ${error}`);
  }
}

// Simple async logging functions that store directly to PostgreSQL
export async function logToDatabase(
  level: "info" | "warn" | "error" | "debug",
  message: string,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    await insertLogToDatabase(level, message, context || {});
  } catch (error) {
    throw new Error(`Failed to log to database: ${error}`);
  }
}

// Convenience functions
export async function logInfo(
  message: string,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!isProduction) {
    console.log(message, context);
  }
  return logToDatabase("info", message, context);
}

export async function logError(
  message: string,
  error?: Error | unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const errorInfo =
    error instanceof Error
      ? { message: error.message, stack: error.stack, name: error.name }
      : error;

  if (!isProduction) {
    console.error(message, errorInfo);
  }

  return logToDatabase("error", message, {
    ...context,
    error: errorInfo,
  });
}

export async function logWarn(
  message: string,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!isProduction) {
    console.warn(message, context);
  }
  return logToDatabase("warn", message, context);
}

export async function logDebug(
  message: string,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!isProduction) {
    console.debug(message, context);
  }
  return logToDatabase("debug", message, context);
}
