// utils/mutations/simulation_chat_standards/update-simulationChatStandard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatStandards } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateSimulationChatStandard(id: string, data: Partial<typeof simulationChatStandards.$inferInsert>) {
  try {
    const result = await db.update(simulationChatStandards).set(data).where(eq(simulationChatStandards.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating simulationChatStandard:", error);
    throw error;
  }
}
