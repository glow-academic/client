// utils/mutations/app_logs/delete-app-log.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { appLogs } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteAppLog(id: number) {
  try {
    const result = await db.delete(appLogs).where(eq(appLogs.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting appLog:", error);
    throw error;
  }
}
