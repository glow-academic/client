// utils/mutations/sessions/update-sessions.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { sessions } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateSessions(sessionTokens: string[], data: Partial<typeof sessions.$inferInsert>) {
  try {
    return await db.update(sessions).set(data).where(inArray(sessions.sessionToken, sessionTokens)).returning();
  } catch (error) {
    console.error("Error updating multiple sessions:", error);
    throw error;
  }
}
