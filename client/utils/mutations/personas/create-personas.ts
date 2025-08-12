// utils/mutations/personas/create-personas.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createPersonas(data: (typeof personas.$inferInsert)[]) {
  try {
    return await db.insert(personas).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple personas",
      subject: { entityType: "personas" },
      context: { function: "_createPersonas", file: "utils/mutations/personas/create-personas.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createPersonas = createMockableAction('createPersonas', _createPersonas);
