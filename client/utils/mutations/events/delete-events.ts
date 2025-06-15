// utils/mutations/events/delete-events.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { events } from "@/utils/drizzle/schema";
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
