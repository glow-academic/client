// utils/mutations/personas/delete-persona.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deletePersona(id: string) {
  try {
    const result = await db
      .delete(personas)
      .where(eq(personas.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logError("Error deleting persona:", error);
    throw error;
  }
}
