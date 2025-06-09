// utils/queries/events/get-events-by-schedules.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { events } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEventsBySchedules(scheduleIds: string[]) {
  try {
    return await db.select().from(events).where(inArray(events.schedule_id, scheduleIds));
  } catch (error) {
    console.error("Error fetching events by schedules:", error);
    throw error;
  }
}
