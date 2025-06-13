// utils/mutations/app_logs/update-app-logs.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { appLogs } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateAppLogs(ids: number[], data: Partial<typeof appLogs.$inferInsert>) {
  try {
    return await db.update(appLogs).set(data).where(inArray(appLogs.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple app_logs:", error);
    throw error;
  }
}
