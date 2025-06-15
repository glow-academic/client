// utils/mutations/app_logs/update-app-log.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appLogs } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateAppLog(id: number, data: Partial<typeof appLogs.$inferInsert>) {
  try {
    const result = await db.update(appLogs).set(data).where(eq(appLogs.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating appLog:", error);
    throw error;
  }
}
