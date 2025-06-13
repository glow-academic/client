// utils/mutations/classes/create-classes.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { classes } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createClasses(data: (typeof classes.$inferInsert)[]) {
  try {
    return await db.insert(classes).values(data).returning();
  } catch (error) {
    logError("Error creating multiple classes:", error);
    throw error;
  }
}
