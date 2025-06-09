// utils/queries/simulations/get-simulations-by-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulations } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationsByClass(classId: string) {
  try {
    return await db.select().from(simulations).where(eq(simulations.classId, classId));
  } catch (error) {
    console.error("Error fetching simulations by class:", error);
    throw error;
  }
}
