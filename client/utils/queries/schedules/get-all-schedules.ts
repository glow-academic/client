// utils/queries/schedules/get-all-schedules.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { schedules } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllSchedules() {
  try {
    return await db.select().from(schedules);
  } catch (error) {
    logError("Error fetching all schedules:", error);
    throw error;
  }
}
