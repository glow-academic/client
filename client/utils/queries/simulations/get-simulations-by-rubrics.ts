// utils/queries/simulations/get-simulations-by-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulations } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationsByRubrics(rubricIds: string[]) {
  try {
    return await db.select().from(simulations).where(inArray(simulations.rubric_id, rubricIds));
  } catch (error) {
    console.error("Error fetching simulations by rubrics:", error);
    throw error;
  }
}
