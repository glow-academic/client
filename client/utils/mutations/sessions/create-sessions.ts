// utils/mutations/sessions/create-sessions.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { sessions } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createSessions(data: (typeof sessions.$inferInsert)[]) {
  try {
    return await db.insert(sessions).values(data).returning();
  } catch (error) {
    logError("Error creating multiple sessions:", error);
    throw error;
  }
}
