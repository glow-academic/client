// utils/mutations/sessions/delete-sessions.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { sessions } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteSessions(sessionTokens: string[]) {
  try {
    return await db.delete(sessions).where(inArray(sessions.sessionToken, sessionTokens)).returning();
  } catch (error) {
    console.error("Error deleting multiple sessions:", error);
    throw error;
  }
}
