// utils/queries/simulations/get-all-simulations.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulations } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllSimulations() {
  try {
    return await db.select().from(simulations);
  } catch (error) {
    logError("Error fetching all simulations:", error);
    throw error;
  }
}
