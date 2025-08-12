// utils/queries/app_logs/get-all-app-logs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appLogs } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllAppLogs() {
  try {
    return await db.select().from(appLogs);
  } catch (error) {
    await log.error("query.fetch_all.failed", {
      message: "Error fetching all app_logs",
      subject: { entityType: "app_logs" },
      context: { function: "_getAllAppLogs", file: "utils/queries/app_logs/get-all-app-logs.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllAppLogs = createMockableAction('getAllAppLogs', _getAllAppLogs);
