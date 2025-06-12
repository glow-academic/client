// utils/mutations/sessions/delete-session.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { sessions } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteSession(sessionToken: string) {
  try {
    const result = await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting session:", error);
    throw error;
  }
}
