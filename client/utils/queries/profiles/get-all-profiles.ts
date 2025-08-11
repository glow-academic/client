// utils/queries/profiles/get-all-profiles.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllProfiles() {
  try {
    return await db.select().from(profiles);
  } catch (error) {
    logError("Error fetching all profiles:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllProfiles = createMockableAction('getAllProfiles', _getAllProfiles);
