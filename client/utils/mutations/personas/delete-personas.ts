// utils/mutations/personas/delete-personas.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deletePersonas(ids: string[]) {
  try {
    return await db.delete(personas).where(inArray(personas.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple personas:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deletePersonas = createMockableAction('deletePersonas', _deletePersonas);
