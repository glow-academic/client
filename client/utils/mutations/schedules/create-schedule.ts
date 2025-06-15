// utils/mutations/schedules/create-schedule.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { schedules } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createSchedule(data: typeof schedules.$inferInsert) {
  try {
    const result = await db.insert(schedules).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating schedule:", error);
    throw error;
  }
}
