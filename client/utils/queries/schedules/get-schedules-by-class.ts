// utils/queries/schedules/get-schedules-by-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { schedules } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSchedulesByClass(classIds: string[]) {
  try {
    return await db.select().from(schedules).where(inArray(schedules.classId, classIds));
  } catch (error) {
    console.error("Error fetching schedules by class:", error);
    throw error;
  }
}
