// utils/queries/providers/get-provider.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { providers } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getProvider(id: string) {
  try {
    const result = await db.select().from(providers).where(eq(providers.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching provider:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getProvider = createMockableAction('getProvider', _getProvider);
