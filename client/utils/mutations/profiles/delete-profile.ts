// utils/mutations/profiles/delete-profile.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteProfile(id: string) {
  try {
    const result = await db.delete(profiles).where(eq(profiles.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting profile",
      subject: { entityType: "profiles", entityId: String(id) },
      context: { function: "_deleteProfile", file: "utils/mutations/profiles/delete-profile.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteProfile = createMockableAction('deleteProfile', _deleteProfile);
