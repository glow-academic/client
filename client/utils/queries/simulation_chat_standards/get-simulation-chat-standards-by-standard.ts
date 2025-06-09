// utils/queries/simulation_chat_standards/get-simulation-chat-standards-by-standard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatStandards } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationChatStandardsByStandard(standardId: string) {
  try {
    return await db.select().from(simulationChatStandards).where(eq(simulationChatStandards.standardId, standardId));
  } catch (error) {
    console.error("Error fetching simulation_chat_standards by standard:", error);
    throw error;
  }
}
