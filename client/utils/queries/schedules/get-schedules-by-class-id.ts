// utils/queries/schedules/get-schedules-by-classid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { schedules } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSchedulesByClassid(classidId: string) {
  try {
    return await db.select().from(schedules).where(eq(schedules.class_id, classidId));
  } catch (error) {
    console.error("Error fetching schedules by classid:", error);
    throw error;
  }
}
