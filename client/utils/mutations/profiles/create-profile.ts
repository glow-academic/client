// utils/mutations/profiles/create-profile.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { profiles } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createProfile(data: typeof profiles.$inferInsert) {
  try {
    const result = await db.insert(profiles).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating profile:", error);
    throw error;
  }
}
