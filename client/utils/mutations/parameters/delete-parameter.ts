// utils/mutations/parameters/delete-parameter.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteParameter(id: string) {
  try {
    const result = await db.delete(parameters).where(eq(parameters.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting parameter:", error);
    throw error;
  }
}
