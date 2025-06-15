// utils/mutations/schedules/create-schedules.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { schedules } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createSchedules(data: (typeof schedules.$inferInsert)[]) {
  try {
    return await db.insert(schedules).values(data).returning();
  } catch (error) {
    logError("Error creating multiple schedules:", error);
    throw error;
  }
}
