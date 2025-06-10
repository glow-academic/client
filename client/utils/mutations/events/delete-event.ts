// utils/mutations/events/delete-event.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { events } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteEvent(id: string) {
  try {
    const result = await db.delete(events).where(eq(events.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting event:", error);
    throw error;
  }
}
