// utils/mutations/app_logs/create-app-log.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appLogs } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createAppLog(data: typeof appLogs.$inferInsert) {
  try {
    const result = await db.insert(appLogs).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating appLog",
      subject: { entityType: "app_logs" },
      context: { function: "_createAppLog", file: "utils/mutations/app_logs/create-app-log.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createAppLog = createMockableAction('createAppLog', _createAppLog);
