// utils/queries/simulation_chat_grades/get-all-simulation-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatGrades } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllSimulationChatGrades() {
  try {
    return await db.select().from(simulationChatGrades);
  } catch (error) {
    logError("Error fetching all simulation_chat_grades:", error);
    throw error;
  }
}
