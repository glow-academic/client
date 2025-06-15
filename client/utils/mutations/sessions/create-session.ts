// utils/mutations/sessions/create-session.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { sessions } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createSession(data: typeof sessions.$inferInsert) {
  try {
    const result = await db.insert(sessions).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating session:", error);
    throw error;
  }
}
