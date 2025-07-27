// utils/mutations/parameters/create-parameters.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createParameters(
  data: (typeof parameters.$inferInsert)[],
) {
  try {
    return await db.insert(parameters).values(data).returning();
  } catch (error) {
    logError("Error creating multiple parameters:", error);
    throw error;
  }
}
