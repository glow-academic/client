"use server";
import { eq } from "drizzle-orm";
import { simulations } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function getSimulation(simulationId: string) {
  const simulation = await db
    .select()
    .from(simulations)
    .where(eq(simulations.id, simulationId))
    .limit(1);
  return simulation[0] || null;
} 