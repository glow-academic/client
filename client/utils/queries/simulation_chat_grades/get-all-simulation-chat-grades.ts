// utils/queries/simulation_chat_grades/get-all-simulation-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatGrades } from "@/drizzle/schema";

export async function getAllSimulationChatGrades() {
  try {
    return await db.select().from(simulationChatGrades);
  } catch (error) {
    console.error("Error fetching all simulation_chat_grades:", error);
    throw error;
  }
}
