// utils/mutations/schedules/create-schedules.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { schedules } from "@/drizzle/schema";

export async function createSchedules(data: (typeof schedules.$inferInsert)[]) {
  try {
    return await db.insert(schedules).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple schedules:", error);
    throw error;
  }
}
