// utils/mutations/parameters/create-parameter.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createParameter(data: typeof parameters.$inferInsert) {
  try {
    const result = await db.insert(parameters).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating parameter:", error);
    throw error;
  }
}
