// utils/mutations/session/delete-session.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { session } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteSession(sessionTokens: string[]) {
  try {
    return await db.delete(session).where(inArray(session.sessionToken, sessionTokens)).returning();
  } catch (error) {
    console.error("Error deleting multiple session:", error);
    throw error;
  }
}
