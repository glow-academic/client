// utils/queries/providers/get-provider.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { providers } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getProvider(id: string) {
  try {
    const result = await db.select().from(providers).where(eq(providers.id, id));
    return result[0] || null;
  } catch (error) {
    await log.error("query.fetch_one.failed", {
      message: "Error fetching provider",
      subject: { entityType: "providers", entityId: String(id) },
      context: { function: "_getProvider", file: "utils/queries/providers/get-provider.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getProvider = createMockableAction('getProvider', _getProvider);
