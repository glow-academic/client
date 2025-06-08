"use server";
import { db } from "@/utils/drizzle/database";
import { schedules } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSchedules(classId: string) {
  const foundSchedules = await db.select().from(schedules).where(eq(schedules.classId, classId));
  return foundSchedules;
} 