// utils/queries/simulations/get-simulations-by-rubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulations } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationsByRubric(rubricId: string) {
  try {
    return await db.select().from(simulations).where(eq(simulations.rubricId, rubricId));
  } catch (error) {
    console.error("Error fetching simulations by rubric:", error);
    throw error;
  }
}
