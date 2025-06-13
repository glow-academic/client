// utils/mutations/simulations/create-simulations.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulations } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createSimulations(data: (typeof simulations.$inferInsert)[]) {
  try {
    return await db.insert(simulations).values(data).returning();
  } catch (error) {
    logError("Error creating multiple simulations:", error);
    throw error;
  }
}
