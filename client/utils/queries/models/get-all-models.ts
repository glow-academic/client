// utils/queries/models/get-all-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { models } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllModels() {
  try {
    return await db.select().from(models);
  } catch (error) {
    logError("Error fetching all models:", error);
    throw error;
  }
}
