// utils/queries/providers/get-all-providers.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { providers } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllProviders() {
  try {
    return await db.select().from(providers);
  } catch (error) {
    logError("Error fetching all providers:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllProviders = createMockableAction('getAllProviders', _getAllProviders);
