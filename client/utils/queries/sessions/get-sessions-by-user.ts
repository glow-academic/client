// utils/queries/sessions/get-sessions-by-user.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { sessions } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSessionsByUser(userId: string) {
  try {
    return await db.select().from(sessions).where(eq(sessions.userId, userId));
  } catch (error) {
    console.error("Error fetching sessions by user:", error);
    throw error;
  }
}
