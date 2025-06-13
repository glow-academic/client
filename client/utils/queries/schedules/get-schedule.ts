// utils/queries/schedules/get-schedule.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { schedules } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSchedule(id: string) {
  try {
    const result = await db.select().from(schedules).where(eq(schedules.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching schedule:", error);
    throw error;
  }
}
