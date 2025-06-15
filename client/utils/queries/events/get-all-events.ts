// utils/queries/events/get-all-events.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { events } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllEvents() {
  try {
    return await db.select().from(events);
  } catch (error) {
    logError("Error fetching all events:", error);
    throw error;
  }
}
