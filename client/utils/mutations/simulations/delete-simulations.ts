// utils/mutations/simulations/delete-simulations.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulations } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSimulations(ids: string[]) {
  try {
    return await db
      .delete(simulations)
      .where(inArray(simulations.id, ids))
      .returning();
  } catch (error) {
    logError("Error deleting multiple simulations:", error);
    throw error;
  }
}
