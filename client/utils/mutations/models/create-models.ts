// utils/mutations/models/create-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { models } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createModels(data: (typeof models.$inferInsert)[]) {
  try {
    return await db.insert(models).values(data).returning();
  } catch (error) {
    logError("Error creating multiple models:", error);
    throw error;
  }
}
