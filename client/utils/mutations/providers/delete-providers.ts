// utils/mutations/providers/delete-providers.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { providers } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteProviders(ids: string[]) {
  try {
    return await db.delete(providers).where(inArray(providers.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple providers:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteProviders = createMockableAction('deleteProviders', _deleteProviders);
