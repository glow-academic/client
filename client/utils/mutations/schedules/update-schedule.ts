// utils/mutations/schedules/update-schedule.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { schedules } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateSchedule(id: string, data: Partial<typeof schedules.$inferInsert>) {
  try {
    const result = await db.update(schedules).set(data).where(eq(schedules.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating schedule:", error);
    throw error;
  }
}
