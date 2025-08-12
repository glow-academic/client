// utils/mutations/app_logs/update-app-logs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appLogs } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateAppLogs(ids: number[], data: Partial<typeof appLogs.$inferInsert>) {
  try {
    return await db.update(appLogs).set(data).where(inArray(appLogs.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.update_many.failed", {
      message: "Error updating multiple app_logs",
      subject: { entityType: "app_logs" },
      context: { function: "_updateAppLogs", file: "utils/mutations/app_logs/update-app-logs.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateAppLogs = createMockableAction('updateAppLogs', _updateAppLogs);
