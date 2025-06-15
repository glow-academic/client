// utils/queries/sessions/get-session.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { sessions } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSession(id: number) {
  try {
    const result = await db.select().from(sessions).where(eq(sessions.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching session:", error);
    throw error;
  }
}
