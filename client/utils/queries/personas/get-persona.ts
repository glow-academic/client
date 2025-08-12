// utils/queries/personas/get-persona.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getPersona(id: string) {
  try {
    const result = await db.select().from(personas).where(eq(personas.id, id));
    return result[0] || null;
  } catch (error) {
    await log.error("query.fetch_one.failed", {
      message: "Error fetching persona",
      subject: { entityType: "personas", entityId: String(id) },
      context: { function: "_getPersona", file: "utils/queries/personas/get-persona.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getPersona = createMockableAction('getPersona', _getPersona);
