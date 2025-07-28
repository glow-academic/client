// utils/mutations/profiles/delete-profiles.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteProfiles(ids: string[]) {
  try {
    return await db.delete(profiles).where(inArray(profiles.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple profiles:", error);
    throw error;
  }
}
