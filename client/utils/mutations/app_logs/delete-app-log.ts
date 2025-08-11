// utils/mutations/app_logs/delete-app-log.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appLogs } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteAppLog(id: number) {
  try {
    const result = await db.delete(appLogs).where(eq(appLogs.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting appLog:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteAppLog = createMockableAction('deleteAppLog', _deleteAppLog);
