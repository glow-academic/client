// utils/queries/simulations/get-all-simulations.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulations } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllSimulations() {
  try {
    return await db.select().from(simulations);
  } catch (error) {
    logError("Error fetching all simulations:", error);
    throw error;
  }
}
