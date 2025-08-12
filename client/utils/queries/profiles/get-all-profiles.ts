// utils/queries/profiles/get-all-profiles.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllProfiles() {
  try {
    return await db.select().from(profiles);
  } catch (error) {
    await log.error("query.fetch_all.failed", {
      message: "Error fetching all profiles",
      subject: { entityType: "profiles" },
      context: { function: "_getAllProfiles", file: "utils/queries/profiles/get-all-profiles.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllProfiles = createMockableAction('getAllProfiles', _getAllProfiles);
