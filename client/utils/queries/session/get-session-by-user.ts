// utils/queries/session/get-session-by-user.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { session } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSessionByUser(userId: string) {
  try {
    return await db.select().from(session).where(eq(session.userId, userId));
  } catch (error) {
    console.error("Error fetching session by user:", error);
    throw error;
  }
}
