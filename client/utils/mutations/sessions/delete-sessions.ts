// utils/mutations/sessions/delete-sessions.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { sessions } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteSessions(ids: string[]) {
  try {
    return await db.delete(sessions).where(inArray(sessions.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple sessions:", error);
    throw error;
  }
}
