// utils/mutations/sessions/update-session.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { sessions } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateSession(sessionToken: string, data: Partial<typeof sessions.$inferInsert>) {
  try {
    const result = await db.update(sessions).set(data).where(eq(sessions.sessionToken, sessionToken)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating session:", error);
    throw error;
  }
}
