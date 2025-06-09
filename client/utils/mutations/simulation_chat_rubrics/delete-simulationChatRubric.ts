// utils/mutations/simulation_chat_rubrics/delete-simulationChatRubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatRubrics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteSimulationChatRubric(id: string) {
  try {
    const result = await db.delete(simulationChatRubrics).where(eq(simulationChatRubrics.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting simulationChatRubric:", error);
    throw error;
  }
}
