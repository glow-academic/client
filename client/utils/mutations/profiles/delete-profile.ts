// utils/mutations/profiles/delete-profile.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteProfile(id: string) {
  try {
    const result = await db.delete(profiles).where(eq(profiles.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting profile:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteProfile = createMockableAction('deleteProfile', _deleteProfile);
