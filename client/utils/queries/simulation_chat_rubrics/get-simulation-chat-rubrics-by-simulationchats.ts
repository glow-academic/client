// utils/queries/simulation_chat_rubrics/get-simulation-chat-rubrics-by-simulation-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatRubrics } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationChatRubricsBySimulationChats(simulationChatIds: string[]) {
  try {
    return await db.select().from(simulationChatRubrics).where(inArray(simulationChatRubrics.simulationChatId, simulationChatIds));
  } catch (error) {
    console.error("Error fetching simulation_chat_rubrics by simulationChats:", error);
    throw error;
  }
}
