// utils/mutations/classes/update-class.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { classes } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateClass(id: string, data: Partial<typeof classes.$inferInsert>) {
  try {
    const result = await db.update(classes).set(data).where(eq(classes.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating class:", error);
    throw error;
  }
}
