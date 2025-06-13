// utils/mutations/profiles/update-profile.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { profiles } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateProfile(id: string, data: Partial<typeof profiles.$inferInsert>) {
  try {
    const result = await db.update(profiles).set(data).where(eq(profiles.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating profile:", error);
    throw error;
  }
}
