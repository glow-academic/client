// utils/queries/simulations/get-simulations-by-rubricid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulations } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationsByRubricid(rubricidId: string) {
  try {
    return await db.select().from(simulations).where(eq(simulations.rubric_id, rubricidId));
  } catch (error) {
    console.error("Error fetching simulations by rubricid:", error);
    throw error;
  }
}
