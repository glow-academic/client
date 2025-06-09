// utils/queries/attempts/get-attempts-by-simulationids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getAttemptsBySimulationids(simulationidIds: string[]) {
  try {
    return await db.select().from(attempts).where(inArray(attempts.simulation_id, simulationidIds));
  } catch (error) {
    console.error("Error fetching attempts by simulationids:", error);
    throw error;
  }
}
