// utils/queries/attempts/get-attempts-by-simulations.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getAttemptsBySimulations(simulationIds: string[]) {
  try {
    return await db.select().from(attempts).where(inArray(attempts.simulationId, simulationIds));
  } catch (error) {
    console.error("Error fetching attempts by simulations:", error);
    throw error;
  }
}
