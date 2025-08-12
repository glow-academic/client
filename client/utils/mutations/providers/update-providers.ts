// utils/mutations/providers/update-providers.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { providers } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateProviders(ids: string[], data: Partial<typeof providers.$inferInsert>) {
  try {
    return await db.update(providers).set(data).where(inArray(providers.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.update_many.failed", {
      message: "Error updating multiple providers",
      subject: { entityType: "providers" },
      context: { function: "_updateProviders", file: "utils/mutations/providers/update-providers.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateProviders = createMockableAction('updateProviders', _updateProviders);
