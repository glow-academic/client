// utils/mutations/personas/create-persona.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createPersona(data: typeof personas.$inferInsert) {
  try {
    const result = await db.insert(personas).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating persona",
      subject: { entityType: "personas" },
      context: { function: "_createPersona", file: "utils/mutations/personas/create-persona.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createPersona = createMockableAction('createPersona', _createPersona);
