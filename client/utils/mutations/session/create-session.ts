// utils/mutations/session/create-session.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { session } from "@/drizzle/schema";

export async function createSession(data: (typeof session.$inferInsert)[]) {
  try {
    return await db.insert(session).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple session:", error);
    throw error;
  }
}
