// utils/mutations/personas/create-personas.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createPersonas(data: (typeof personas.$inferInsert)[]) {
  try {
    return await db.insert(personas).values(data).returning();
  } catch (error) {
    logError("Error creating multiple personas:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createPersonas = createMockableAction('createPersonas', _createPersonas);
