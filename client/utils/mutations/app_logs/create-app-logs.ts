// utils/mutations/app_logs/create-app-logs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appLogs } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createAppLogs(data: (typeof appLogs.$inferInsert)[]) {
  try {
    return await db.insert(appLogs).values(data).returning();
  } catch (error) {
    logError("Error creating multiple app_logs:", error);
    throw error;
  }
}
