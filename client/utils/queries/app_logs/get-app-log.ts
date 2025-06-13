// utils/queries/app_logs/get-app-log.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { appLogs } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getAppLog(id: string) {
  try {
    const result = await db.select().from(appLogs).where(eq(appLogs.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching appLog:", error);
    throw error;
  }
}
