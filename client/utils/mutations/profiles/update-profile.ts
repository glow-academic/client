// utils/mutations/profiles/update-profile.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateProfile(id: string, data: Partial<typeof profiles.$inferInsert>) {
  try {
    const result = await db.update(profiles).set(data).where(eq(profiles.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.update.failed", {
      message: "Error updating profile",
      subject: { entityType: "profiles", entityId: String(id) },
      context: { function: "_updateProfile", file: "utils/mutations/profiles/update-profile.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateProfile = createMockableAction('updateProfile', _updateProfile);
