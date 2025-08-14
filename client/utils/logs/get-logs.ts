// utils/logs/get-logs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appLogs } from "@/utils/drizzle/schema";
import { log } from "@/utils/server-logger";
import { count, desc } from "drizzle-orm";

interface GetAppLogsParams {
  page?: number;
  limit?: number;
}

interface GetAppLogsResponse {
  logs: Array<{
    id: number;
    event: string;
    level: string;
    message: string | null;
    correlationId: string | null;
    actor: unknown;
    subject: unknown;
    metrics: unknown;
    context: unknown;
    error: unknown;
    createdAt: string | null;
  }>;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Get paginated logs, sorted by createdAt descending
export async function getAppLogs({
  page = 1,
  limit = 1000, // Increased to get more logs for client-side filtering
}: GetAppLogsParams = {}): Promise<GetAppLogsResponse> {
  try {
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await db.select({ totalCount: count() }).from(appLogs);

    const totalCount = countResult[0]?.totalCount || 0;

    // Get paginated logs
    const logs = await db
      .select()
      .from(appLogs)
      .orderBy(desc(appLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      logs,
      totalCount,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  } catch (error) {
    log.error("logs.fetch.failed", {
      message: "Error fetching paginated app_logs",
      error,
      context: { function: "getAppLogs" },
    });
    throw error;
  }
}
