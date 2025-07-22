// utils/queries/personas/get-all-personas.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllPersonas() {
  try {
    return await db.select().from(personas);
  } catch (error) {
    logError("Error fetching all personas:", error);
    throw error;
  }
}
