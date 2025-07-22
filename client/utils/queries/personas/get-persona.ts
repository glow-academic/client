// utils/queries/personas/get-persona.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getPersona(id: string) {
  try {
    const result = await db.select().from(personas).where(eq(personas.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching persona:", error);
    throw error;
  }
}
