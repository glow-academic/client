// utils/mutations/sessions/delete-sessions.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { sessions } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSessions(ids: number[]) {
  try {
    return await db
      .delete(sessions)
      .where(inArray(sessions.id, ids))
      .returning();
  } catch (error) {
    logError("Error deleting multiple sessions:", error);
    throw error;
  }
}
