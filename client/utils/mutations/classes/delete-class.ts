// utils/mutations/classes/delete-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { classes } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteClass(id: string) {
  try {
    const result = await db.delete(classes).where(eq(classes.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting class:", error);
    throw error;
  }
}
