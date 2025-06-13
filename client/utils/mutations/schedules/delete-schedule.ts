// utils/mutations/schedules/delete-schedule.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { schedules } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSchedule(id: string) {
  try {
    const result = await db.delete(schedules).where(eq(schedules.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting schedule:", error);
    throw error;
  }
}
