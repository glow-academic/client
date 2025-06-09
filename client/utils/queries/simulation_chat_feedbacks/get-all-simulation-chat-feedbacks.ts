// utils/queries/simulation_chat_feedbacks/get-all-simulation-chat-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatFeedbacks } from "@/drizzle/schema";

export async function getAllSimulationChatFeedbacks() {
  try {
    return await db.select().from(simulationChatFeedbacks);
  } catch (error) {
    console.error("Error fetching all simulation_chat_feedbacks:", error);
    throw error;
  }
}
