// utils/queries/events/get-events-by-schedule.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { events } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEventsBySchedule(scheduleId: string) {
  try {
    return await db.select().from(events).where(eq(events.schedule_id, scheduleId));
  } catch (error) {
    console.error("Error fetching events by schedule:", error);
    throw error;
  }
}
