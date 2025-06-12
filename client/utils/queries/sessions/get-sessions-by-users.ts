// utils/queries/sessions/get-sessions-by-users.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { sessions } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSessionsByUsers(userIds: string[]) {
  try {
    return await db.select().from(sessions).where(inArray(sessions.userId, userIds));
  } catch (error) {
    console.error("Error fetching sessions by users:", error);
    throw error;
  }
}
