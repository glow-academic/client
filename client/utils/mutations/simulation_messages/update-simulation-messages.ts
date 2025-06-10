// utils/mutations/simulation_messages/update-simulation-messages.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationMessages } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateSimulationMessages(
  ids: string[],
  data: Partial<typeof simulationMessages.$inferInsert>,
) {
  try {
    return await db
      .update(simulationMessages)
      .set(data)
      .where(inArray(simulationMessages.id, ids))
      .returning();
  } catch (error) {
    console.error("Error updating multiple simulation_messages:", error);
    throw error;
  }
}
