// utils/queries/simulations/get-simulation.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulations } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulation(id: string) {
  try {
    const result = await db.select().from(simulations).where(eq(simulations.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching simulation:", error);
    throw error;
  }
}
