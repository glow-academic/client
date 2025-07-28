// utils/mutations/personas/update-persona.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updatePersona(id: string, data: Partial<typeof personas.$inferInsert>) {
  try {
    const result = await db.update(personas).set(data).where(eq(personas.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating persona:", error);
    throw error;
  }
}
