// utils/queries/schedules/get-schedules-by-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { schedules } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSchedulesByClass(classId: string) {
  try {
    return await db.select().from(schedules).where(eq(schedules.classId, classId));
  } catch (error) {
    console.error("Error fetching schedules by class:", error);
    throw error;
  }
}
