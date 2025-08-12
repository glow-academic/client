// utils/mutations/personas/update-persona.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updatePersona(id: string, data: Partial<typeof personas.$inferInsert>) {
  try {
    const result = await db.update(personas).set(data).where(eq(personas.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.update.failed", {
      message: "Error updating persona",
      subject: { entityType: "personas", entityId: String(id) },
      context: { function: "_updatePersona", file: "utils/mutations/personas/update-persona.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updatePersona = createMockableAction('updatePersona', _updatePersona);
