// utils/mutations/sessions/create-sessions.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { sessions } from "@/drizzle/schema";

export async function createSessions(data: (typeof sessions.$inferInsert)[]) {
  try {
    return await db.insert(sessions).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple sessions:", error);
    throw error;
  }
}
