// utils/queries/sessions/get-all-sessions.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { sessions } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllSessions() {
  try {
    return await db.select().from(sessions);
  } catch (error) {
    logError("Error fetching all sessions:", error);
    throw error;
  }
}
