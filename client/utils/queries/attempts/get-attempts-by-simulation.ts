// utils/queries/attempts/get-attempts-by-simulation.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getAttemptsBySimulation(simulationId: string) {
  try {
    return await db.select().from(attempts).where(eq(attempts.simulation_id, simulationId));
  } catch (error) {
    console.error("Error fetching attempts by simulation:", error);
    throw error;
  }
}
