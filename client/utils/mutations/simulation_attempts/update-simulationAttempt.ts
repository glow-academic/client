// utils/mutations/simulation_attempts/update-simulationAttempt.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationAttempts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateSimulationAttempt(
  id: string,
  data: Partial<typeof simulationAttempts.$inferInsert>,
) {
  try {
    const result = await db
      .update(simulationAttempts)
      .set(data)
      .where(eq(simulationAttempts.id, id))
      .returning();
    return result[0];
  } catch (error) {
    console.error("Error updating simulationAttempt:", error);
    throw error;
  }
}
