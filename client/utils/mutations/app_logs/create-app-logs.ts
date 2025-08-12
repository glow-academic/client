// utils/mutations/app_logs/create-app-logs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appLogs } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createAppLogs(data: (typeof appLogs.$inferInsert)[]) {
  try {
    return await db.insert(appLogs).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple app_logs",
      subject: { entityType: "app_logs" },
      context: { function: "_createAppLogs", file: "utils/mutations/app_logs/create-app-logs.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createAppLogs = createMockableAction('createAppLogs', _createAppLogs);
