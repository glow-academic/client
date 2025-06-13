// utils/queries/app_logs/get-all-app-logs.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { appLogs } from "@/drizzle/schema";

export async function getAllAppLogs() {
  try {
    return await db.select().from(appLogs);
  } catch (error) {
    console.error("Error fetching all app_logs:", error);
    throw error;
  }
}
