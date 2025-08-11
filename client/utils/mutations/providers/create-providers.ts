// utils/mutations/providers/create-providers.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { providers } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createProviders(data: (typeof providers.$inferInsert)[]) {
  try {
    return await db.insert(providers).values(data).returning();
  } catch (error) {
    logError("Error creating multiple providers:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createProviders = createMockableAction('createProviders', _createProviders);
