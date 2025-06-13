// utils/mutations/profiles/update-profiles.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { profiles } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateProfiles(ids: string[], data: Partial<typeof profiles.$inferInsert>) {
  try {
    return await db.update(profiles).set(data).where(inArray(profiles.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple profiles:", error);
    throw error;
  }
}
