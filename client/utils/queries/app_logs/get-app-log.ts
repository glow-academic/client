// utils/queries/app_logs/get-app-log.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { appLogs } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getAppLog(id: number) {
  try {
    const result = await db.select().from(appLogs).where(eq(appLogs.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching appLog:", error);
    throw error;
  }
}
