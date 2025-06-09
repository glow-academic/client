// utils/queries/simulation_chat_rubrics/get-all-simulation-chat-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatRubrics } from "@/drizzle/schema";

export async function getAllSimulationChatRubrics() {
  try {
    return await db.select().from(simulationChatRubrics);
  } catch (error) {
    console.error("Error fetching all simulation_chat_rubrics:", error);
    throw error;
  }
}
