// utils/mutations/events/update-events.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { events } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateEvents(ids: string[], data: Partial<typeof events.$inferInsert>) {
  try {
    return await db.update(events).set(data).where(inArray(events.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple events:", error);
    throw error;
  }
}
