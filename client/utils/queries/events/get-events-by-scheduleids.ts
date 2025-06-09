// utils/queries/events/get-events-by-scheduleids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { events } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEventsByScheduleids(scheduleidIds: string[]) {
  try {
    return await db.select().from(events).where(inArray(events.schedule_id, scheduleidIds));
  } catch (error) {
    console.error("Error fetching events by scheduleids:", error);
    throw error;
  }
}
