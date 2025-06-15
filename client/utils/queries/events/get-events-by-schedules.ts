// utils/queries/events/get-events-by-schedules.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { events } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEventsBySchedules(scheduleIds: string[]) {
  try {
    return await db.select().from(events).where(inArray(events.scheduleId, scheduleIds));
  } catch (error) {
    logError("Error fetching events by schedules:", error);
    throw error;
  }
}
