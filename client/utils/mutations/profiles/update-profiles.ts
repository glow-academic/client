// utils/mutations/profiles/update-profiles.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { profiles } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateProfiles(ids: string[], data: Partial<typeof profiles.$inferInsert>) {
  try {
    return await db.update(profiles).set(data).where(inArray(profiles.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple profiles:", error);
    throw error;
  }
}
