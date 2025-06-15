// utils/mutations/schedules/update-schedules.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { schedules } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateSchedules(ids: string[], data: Partial<typeof schedules.$inferInsert>) {
  try {
    return await db.update(schedules).set(data).where(inArray(schedules.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple schedules:", error);
    throw error;
  }
}
