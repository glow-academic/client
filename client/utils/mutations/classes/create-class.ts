// utils/mutations/classes/create-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { classes } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createClass(data: typeof classes.$inferInsert) {
  try {
    const result = await db.insert(classes).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating class:", error);
    throw error;
  }
}
