// utils/mutations/providers/create-providers.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { providers } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createProviders(data: (typeof providers.$inferInsert)[]) {
  try {
    return await db.insert(providers).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple providers",
      subject: { entityType: "providers" },
      context: { function: "_createProviders", file: "utils/mutations/providers/create-providers.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createProviders = createMockableAction('createProviders', _createProviders);
