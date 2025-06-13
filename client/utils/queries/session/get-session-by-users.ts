// utils/queries/session/get-session-by-users.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { session } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSessionByUsers(userIds: string[]) {
  try {
    return await db.select().from(session).where(inArray(session.userId, userIds));
  } catch (error) {
    console.error("Error fetching session by users:", error);
    throw error;
  }
}
