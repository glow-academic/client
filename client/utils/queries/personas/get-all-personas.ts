// utils/queries/personas/get-all-personas.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllPersonas() {
  try {
    return await db.select().from(personas);
  } catch (error) {
    await log.error("query.fetch_all.failed", {
      message: "Error fetching all personas",
      subject: { entityType: "personas" },
      context: { function: "_getAllPersonas", file: "utils/queries/personas/get-all-personas.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllPersonas = createMockableAction('getAllPersonas', _getAllPersonas);
