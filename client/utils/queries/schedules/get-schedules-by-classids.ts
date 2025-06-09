// utils/queries/schedules/get-schedules-by-classids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { schedules } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSchedulesByClassids(classidIds: string[]) {
  try {
    return await db.select().from(schedules).where(inArray(schedules.class_id, classidIds));
  } catch (error) {
    console.error("Error fetching schedules by classids:", error);
    throw error;
  }
}
