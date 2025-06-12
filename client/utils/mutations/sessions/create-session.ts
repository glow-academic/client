// utils/mutations/sessions/create-session.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { sessions } from "@/drizzle/schema";

export async function createSession(data: typeof sessions.$inferInsert) {
  try {
    const result = await db.insert(sessions).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating session:", error);
    throw error;
  }
}
