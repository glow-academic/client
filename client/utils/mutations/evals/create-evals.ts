// utils/mutations/evals/create-evals.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createEvals(data: (typeof evals.$inferInsert)[]) {
  try {
    return await db.insert(evals).values(data).returning();
  } catch (error) {
    logError("Error creating multiple evals:", error);
    throw error;
  }
}
