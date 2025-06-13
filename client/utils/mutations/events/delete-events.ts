// utils/mutations/events/delete-events.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { events } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteEvents(ids: string[]) {
  try {
    return await db.delete(events).where(inArray(events.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple events:", error);
    throw error;
  }
}
