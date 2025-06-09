// utils/mutations/simulation_chat_rubrics/create-simulation-chat-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatRubrics } from "@/drizzle/schema";

export async function createSimulationChatRubrics(data: (typeof simulationChatRubrics.$inferInsert)[]) {
  try {
    return await db.insert(simulationChatRubrics).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple simulation_chat_rubrics:", error);
    throw error;
  }
}
