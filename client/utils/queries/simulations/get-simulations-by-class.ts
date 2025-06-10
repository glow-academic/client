// utils/queries/simulations/get-simulations-by-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulations } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationsByClass(classIds: string[]) {
  try {
    return await db
      .select()
      .from(simulations)
      .where(inArray(simulations.classId, classIds));
  } catch (error) {
    console.error("Error fetching simulations by class:", error);
    throw error;
  }
}
