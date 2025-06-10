// utils/mutations/simulations/update-simulations.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulations } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateSimulations(ids: string[], data: Partial<typeof simulations.$inferInsert>) {
  try {
    return await db.update(simulations).set(data).where(inArray(simulations.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple simulations:", error);
    throw error;
  }
}
