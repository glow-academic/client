// utils/mutations/app_logs/delete-app-logs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appLogs } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteAppLogs(ids: number[]) {
  try {
    return await db.delete(appLogs).where(inArray(appLogs.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple app_logs",
      subject: { entityType: "app_logs" },
      context: { function: "_deleteAppLogs", file: "utils/mutations/app_logs/delete-app-logs.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteAppLogs = createMockableAction('deleteAppLogs', _deleteAppLogs);
