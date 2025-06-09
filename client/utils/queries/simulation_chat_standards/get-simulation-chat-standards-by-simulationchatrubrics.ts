// utils/queries/simulation_chat_standards/get-simulation-chat-standards-by-simulation-chat-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatStandards } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationChatStandardsBySimulationChatRubrics(simulationChatRubricIds: string[]) {
  try {
    return await db.select().from(simulationChatStandards).where(inArray(simulationChatStandards.simulationChatRubricId, simulationChatRubricIds));
  } catch (error) {
    console.error("Error fetching simulation_chat_standards by simulationChatRubrics:", error);
    throw error;
  }
}
