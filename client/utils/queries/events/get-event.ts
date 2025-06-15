// utils/queries/events/get-event.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { events } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvent(id: string) {
  try {
    const result = await db.select().from(events).where(eq(events.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching event:", error);
    throw error;
  }
}
