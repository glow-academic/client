// utils/queries/schedules/get-all-schedules.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { schedules } from "@/drizzle/schema";

export async function getAllSchedules() {
  try {
    return await db.select().from(schedules);
  } catch (error) {
    console.error("Error fetching all schedules:", error);
    throw error;
  }
}
