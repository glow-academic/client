// utils/mutations/standards/create-standard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standards } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createStandard(data: typeof standards.$inferInsert) {
  try {
    const result = await db.insert(standards).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating standard:", error);
    throw error;
  }
}
