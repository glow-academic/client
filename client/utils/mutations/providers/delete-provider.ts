// utils/mutations/providers/delete-provider.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { providers } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteProvider(id: string) {
  try {
    const result = await db.delete(providers).where(eq(providers.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting provider",
      subject: { entityType: "providers", entityId: String(id) },
      context: { function: "_deleteProvider", file: "utils/mutations/providers/delete-provider.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteProvider = createMockableAction('deleteProvider', _deleteProvider);
