// utils/queries/events/get-event.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { events } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvent(id: string) {
  try {
    const result = await db.select().from(events).where(eq(events.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching event:", error);
    throw error;
  }
}
