// utils/queries/events/get-all-events.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { events } from "@/drizzle/schema";

export async function getAllEvents() {
  try {
    return await db.select().from(events);
  } catch (error) {
    console.error("Error fetching all events:", error);
    throw error;
  }
}
