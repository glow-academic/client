// utils/mutations/session/update-session.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { session } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateSession(sessionTokens: string[], data: Partial<typeof session.$inferInsert>) {
  try {
    return await db.update(session).set(data).where(inArray(session.sessionToken, sessionTokens)).returning();
  } catch (error) {
    console.error("Error updating multiple session:", error);
    throw error;
  }
}
