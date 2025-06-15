// utils/queries/schedules/get-schedules-by-class.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { schedules } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSchedulesByClass(classIds: string[]) {
  try {
    return await db.select().from(schedules).where(inArray(schedules.classId, classIds));
  } catch (error) {
    logError("Error fetching schedules by class:", error);
    throw error;
  }
}
