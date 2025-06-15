// utils/mutations/simulations/update-simulation.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulations } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateSimulation(id: string, data: Partial<typeof simulations.$inferInsert>) {
  try {
    const result = await db.update(simulations).set(data).where(eq(simulations.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating simulation:", error);
    throw error;
  }
}
