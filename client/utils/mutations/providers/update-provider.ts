// utils/mutations/providers/update-provider.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { providers } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateProvider(id: string, data: Partial<typeof providers.$inferInsert>) {
  try {
    const result = await db.update(providers).set(data).where(eq(providers.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating provider:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateProvider = createMockableAction('updateProvider', _updateProvider);
