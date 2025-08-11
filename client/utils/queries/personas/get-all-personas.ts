// utils/queries/personas/get-all-personas.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllPersonas() {
  try {
    return await db.select().from(personas);
  } catch (error) {
    logError("Error fetching all personas:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllPersonas = createMockableAction('getAllPersonas', _getAllPersonas);
