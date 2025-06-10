// utils/mutations/events/delete-events.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { events } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteEvents(ids: string[]) {
  try {
    return await db.delete(events).where(inArray(events.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple events:", error);
    throw error;
  }
}
