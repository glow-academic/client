// utils/mutations/models/update-model.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { models } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateModel(
  id: string,
  data: Partial<typeof models.$inferInsert>,
) {
  try {
    const result = await db
      .update(models)
      .set(data)
      .where(eq(models.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logError("Error updating model:", error);
    throw error;
  }
}
