// utils/mutations/personas/delete-personas.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deletePersonas(ids: string[]) {
  try {
    return await db.delete(personas).where(inArray(personas.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple personas",
      subject: { entityType: "personas" },
      context: { function: "_deletePersonas", file: "utils/mutations/personas/delete-personas.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deletePersonas = createMockableAction('deletePersonas', _deletePersonas);
