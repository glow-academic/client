// utils/queries/app_logs/get-all-app-logs.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { appLogs } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllAppLogs() {
  try {
    return await db.select().from(appLogs);
  } catch (error) {
    logError("Error fetching all app_logs:", error);
    throw error;
  }
}
