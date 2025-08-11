// utils/mutations/app_logs/update-app-log.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appLogs } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateAppLog(id: string, data: Partial<typeof appLogs.$inferInsert>) {
  try {
    const result = await db.update(appLogs).set(data).where(eq(appLogs.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating appLog:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateAppLog = createMockableAction('updateAppLog', _updateAppLog);
