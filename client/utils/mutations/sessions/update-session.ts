// utils/mutations/sessions/update-session.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { sessions } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateSession(
  id: number,
  data: Partial<typeof sessions.$inferInsert>,
) {
  try {
    const result = await db
      .update(sessions)
      .set(data)
      .where(eq(sessions.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logError("Error updating session:", error);
    throw error;
  }
}
