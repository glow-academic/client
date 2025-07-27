// utils/mutations/sessions/delete-session.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { sessions } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSession(id: number) {
  try {
    const result = await db
      .delete(sessions)
      .where(eq(sessions.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logError("Error deleting session:", error);
    throw error;
  }
}
