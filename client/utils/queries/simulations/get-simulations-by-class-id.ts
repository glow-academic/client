// utils/queries/simulations/get-simulations-by-classid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulations } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationsByClassid(classidId: string) {
  try {
    return await db.select().from(simulations).where(eq(simulations.class_id, classidId));
  } catch (error) {
    console.error("Error fetching simulations by classid:", error);
    throw error;
  }
}
