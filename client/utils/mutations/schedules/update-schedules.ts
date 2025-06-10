// utils/mutations/schedules/update-schedules.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { schedules } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateSchedules(
  ids: string[],
  data: Partial<typeof schedules.$inferInsert>,
) {
  try {
    return await db
      .update(schedules)
      .set(data)
      .where(inArray(schedules.id, ids))
      .returning();
  } catch (error) {
    console.error("Error updating multiple schedules:", error);
    throw error;
  }
}
