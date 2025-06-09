// utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulation-chat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationChatGradesBySimulationChat(simulationChatId: string) {
  try {
    return await db.select().from(simulationChatGrades).where(eq(simulationChatGrades.simulationChatId, simulationChatId));
  } catch (error) {
    console.error("Error fetching simulation_chat_grades by simulationChat:", error);
    throw error;
  }
}
