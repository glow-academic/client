// utils/mutations/events/create-events.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { events } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createEvents(data: (typeof events.$inferInsert)[]) {
  try {
    return await db.insert(events).values(data).returning();
  } catch (error) {
    logError("Error creating multiple events:", error);
    throw error;
  }
}
