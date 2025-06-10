// utils/mutations/events/update-event.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { events } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateEvent(id: string, data: Partial<typeof events.$inferInsert>) {
  try {
    const result = await db.update(events).set(data).where(eq(events.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating event:", error);
    throw error;
  }
}
