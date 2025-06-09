// utils/queries/simulation_chat_standards/get-simulation-chat-standards-by-simulation-chat-rubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatStandards } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationChatStandardsBySimulationChatRubric(simulationChatRubricId: string) {
  try {
    return await db.select().from(simulationChatStandards).where(eq(simulationChatStandards.simulationChatRubricId, simulationChatRubricId));
  } catch (error) {
    console.error("Error fetching simulation_chat_standards by simulationChatRubric:", error);
    throw error;
  }
}
