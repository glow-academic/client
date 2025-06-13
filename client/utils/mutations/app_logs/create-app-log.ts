// utils/mutations/app_logs/create-app-log.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { appLogs } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createAppLog(data: typeof appLogs.$inferInsert) {
  try {
    const result = await db.insert(appLogs).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating appLog:", error);
    throw error;
  }
}
