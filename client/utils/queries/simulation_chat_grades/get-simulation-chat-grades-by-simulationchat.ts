// utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulation-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatGrades } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationChatGradesBySimulationChat(simulationChatId: string) {
  try {
    return await db.select().from(simulationChatGrades).where(eq(simulationChatGrades.simulationChatId, simulationChatId));
  } catch (error) {
    logError("Error fetching simulation_chat_grades by simulationChat:", error);
    throw error;
  }
}
