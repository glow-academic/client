// utils/mutations/profiles/create-profiles.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createProfiles(data: (typeof profiles.$inferInsert)[]) {
  try {
    return await db.insert(profiles).values(data).returning();
  } catch (error) {
    logError("Error creating multiple profiles:", error);
    throw error;
  }
}
