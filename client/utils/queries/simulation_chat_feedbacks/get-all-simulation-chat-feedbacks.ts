// utils/queries/simulation_chat_feedbacks/get-all-simulation-chat-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatFeedbacks } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllSimulationChatFeedbacks() {
  try {
    return await db.select().from(simulationChatFeedbacks);
  } catch (error) {
    logError("Error fetching all simulation_chat_feedbacks:", error);
    throw error;
  }
}
