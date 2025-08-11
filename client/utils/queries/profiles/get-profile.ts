// utils/queries/profiles/get-profile.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getProfile(id: string) {
  try {
    const result = await db.select().from(profiles).where(eq(profiles.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching profile:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getProfile = createMockableAction('getProfile', _getProfile);
