// utils/queries/profiles/get-profiles-by-users.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getProfilesByUsers(userIds: number[]) {
  try {
    return await db.select().from(profiles).where(inArray(profiles.userId, userIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching profiles by users",
      subject: { entityType: "profiles" },
      context: { function: "_getProfilesByUsers", file: "utils/queries/profiles/get-profiles-by-users.ts", foreignKey: "userId", foreignIdsCount: userIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getProfilesByUsers = createMockableAction('getProfilesByUsers', _getProfilesByUsers);
