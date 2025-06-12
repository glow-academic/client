// utils/queries/sessions/get-session.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { sessions } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSession(sessionToken: string) {
  try {
    const result = await db.select().from(sessions).where(eq(sessions.sessionToken, sessionToken));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching session:", error);
    throw error;
  }
}
