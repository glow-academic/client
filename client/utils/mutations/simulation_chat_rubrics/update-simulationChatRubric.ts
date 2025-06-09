// utils/mutations/simulation_chat_rubrics/update-simulationChatRubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatRubrics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateSimulationChatRubric(id: string, data: Partial<typeof simulationChatRubrics.$inferInsert>) {
  try {
    const result = await db.update(simulationChatRubrics).set(data).where(eq(simulationChatRubrics.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating simulationChatRubric:", error);
    throw error;
  }
}
