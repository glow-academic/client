// utils/mutations/models/create-model.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { models } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createModel(data: typeof models.$inferInsert) {
  try {
    const result = await db.insert(models).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating model:", error);
    throw error;
  }
}
