// utils/queries/attempts/get-attempts-by-users.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getAttemptsByUsers(userIds: string[]) {
  try {
    return await db.select().from(attempts).where(inArray(attempts.userId, userIds));
  } catch (error) {
    console.error("Error fetching attempts by users:", error);
    throw error;
  }
}
