// utils/mutations/app_logs/delete-app-logs.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { appLogs } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteAppLogs(ids: number[]) {
  try {
    return await db.delete(appLogs).where(inArray(appLogs.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple app_logs:", error);
    throw error;
  }
}
