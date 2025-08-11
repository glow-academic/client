// utils/queries/app_logs/get-app-log.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appLogs } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAppLog(id: string) {
  try {
    const result = await db.select().from(appLogs).where(eq(appLogs.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching appLog:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAppLog = createMockableAction('getAppLog', _getAppLog);
