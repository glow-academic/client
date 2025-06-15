// utils/mutations/schedules/delete-schedules.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { schedules } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSchedules(ids: string[]) {
  try {
    return await db.delete(schedules).where(inArray(schedules.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple schedules:", error);
    throw error;
  }
}
