// utils/mutations/simulations/create-simulations.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulations } from "@/drizzle/schema";

export async function createSimulations(data: (typeof simulations.$inferInsert)[]) {
  try {
    return await db.insert(simulations).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple simulations:", error);
    throw error;
  }
}
