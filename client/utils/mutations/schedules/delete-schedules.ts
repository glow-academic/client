// utils/mutations/schedules/delete-schedules.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { schedules } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteSchedules(ids: string[]) {
  try {
    return await db
      .delete(schedules)
      .where(inArray(schedules.id, ids))
      .returning();
  } catch (error) {
    console.error("Error deleting multiple schedules:", error);
    throw error;
  }
}
