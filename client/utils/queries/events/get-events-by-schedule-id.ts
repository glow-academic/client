// utils/queries/events/get-events-by-scheduleid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { events } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEventsByScheduleid(scheduleidId: string) {
  try {
    return await db.select().from(events).where(eq(events.schedule_id, scheduleidId));
  } catch (error) {
    console.error("Error fetching events by scheduleid:", error);
    throw error;
  }
}
