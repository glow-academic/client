// utils/mutations/simulations/create-simulation.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulations } from "@/drizzle/schema";

export async function createSimulation(data: typeof simulations.$inferInsert) {
  try {
    const result = await db.insert(simulations).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating simulation:", error);
    throw error;
  }
}
