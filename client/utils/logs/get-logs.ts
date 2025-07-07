// utils/logs/get-logs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appLogs } from "@/utils/drizzle/schema";
import { desc } from "drizzle-orm";
import { logError } from "@/utils/logger";
// get last 50 logs, sorted by createdAt descending
export async function getAppLogs() {
  try {
    return await db.select().from(appLogs).orderBy(desc(appLogs.createdAt)).limit(50) ;
  } catch (error) {
    logError("Error fetching all app_logs:", error);
    throw error;
  }
}
