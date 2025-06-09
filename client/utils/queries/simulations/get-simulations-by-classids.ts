// utils/queries/simulations/get-simulations-by-classids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulations } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationsByClassids(classidIds: string[]) {
  try {
    return await db.select().from(simulations).where(inArray(simulations.class_id, classidIds));
  } catch (error) {
    console.error("Error fetching simulations by classids:", error);
    throw error;
  }
}
