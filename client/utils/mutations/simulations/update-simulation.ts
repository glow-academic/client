// utils/mutations/simulations/update-simulation.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulations } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateSimulation(id: string, data: Partial<typeof simulations.$inferInsert>) {
  try {
    const result = await db.update(simulations).set(data).where(eq(simulations.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating simulation:", error);
    throw error;
  }
}
