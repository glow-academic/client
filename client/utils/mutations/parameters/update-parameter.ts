// utils/mutations/parameters/update-parameter.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateParameter(id: string, data: Partial<typeof parameters.$inferInsert>) {
  try {
    const result = await db.update(parameters).set(data).where(eq(parameters.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating parameter:", error);
    throw error;
  }
}
