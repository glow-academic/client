// utils/mutations/events/create-event.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { events } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createEvent(data: typeof events.$inferInsert) {
  try {
    const result = await db.insert(events).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating event:", error);
    throw error;
  }
}
