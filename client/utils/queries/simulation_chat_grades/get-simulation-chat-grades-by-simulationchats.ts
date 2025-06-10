// utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulation-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatGrades } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationChatGradesBySimulationChats(simulationChatIds: string[]) {
  try {
    return await db.select().from(simulationChatGrades).where(inArray(simulationChatGrades.simulationChatId, simulationChatIds));
  } catch (error) {
    console.error("Error fetching simulation_chat_grades by simulationChats:", error);
    throw error;
  }
}
