// utils/mutations/simulations/delete-simulations.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulations } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSimulations(ids: string[]) {
  try {
    return await db.delete(simulations).where(inArray(simulations.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple simulations:", error);
    throw error;
  }
}
