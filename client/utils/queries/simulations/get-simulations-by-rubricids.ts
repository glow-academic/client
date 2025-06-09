// utils/queries/simulations/get-simulations-by-rubricids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulations } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationsByRubricids(rubricidIds: string[]) {
  try {
    return await db.select().from(simulations).where(inArray(simulations.rubric_id, rubricidIds));
  } catch (error) {
    console.error("Error fetching simulations by rubricids:", error);
    throw error;
  }
}
