// utils/mutations/simulation_chat_rubrics/create-simulationChatRubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatRubrics } from "@/drizzle/schema";

export async function createSimulationChatRubric(data: typeof simulationChatRubrics.$inferInsert) {
  try {
    const result = await db.insert(simulationChatRubrics).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating simulationChatRubric:", error);
    throw error;
  }
}
