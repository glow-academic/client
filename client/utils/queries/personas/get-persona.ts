// utils/queries/personas/get-persona.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getPersona(id: string) {
  try {
    const result = await db.select().from(personas).where(eq(personas.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching persona:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getPersona = createMockableAction('getPersona', _getPersona);
