// utils/queries/simulation_chat_rubrics/get-simulation-chat-rubrics-by-simulation-chat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatRubrics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationChatRubricsBySimulationChat(simulationChatId: string) {
  try {
    return await db.select().from(simulationChatRubrics).where(eq(simulationChatRubrics.simulationChatId, simulationChatId));
  } catch (error) {
    console.error("Error fetching simulation_chat_rubrics by simulationChat:", error);
    throw error;
  }
}
