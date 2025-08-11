// utils/mutations/providers/update-providers.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { providers } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateProviders(ids: string[], data: Partial<typeof providers.$inferInsert>) {
  try {
    return await db.update(providers).set(data).where(inArray(providers.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple providers:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateProviders = createMockableAction('updateProviders', _updateProviders);
