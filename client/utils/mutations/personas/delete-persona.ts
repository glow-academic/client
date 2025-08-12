// utils/mutations/personas/delete-persona.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deletePersona(id: string) {
  try {
    const result = await db.delete(personas).where(eq(personas.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting persona",
      subject: { entityType: "personas", entityId: String(id) },
      context: { function: "_deletePersona", file: "utils/mutations/personas/delete-persona.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deletePersona = createMockableAction('deletePersona', _deletePersona);
