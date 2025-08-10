// utils/queries/simulation_chat_crowdsourced_feedbacks/get-all-simulation-chat-crowdsourced-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllSimulationChatCrowdsourcedFeedbacks() {
  try {
    return await db.select().from(simulationChatCrowdsourcedFeedbacks);
  } catch (error) {
    logError("Error fetching all simulation_chat_crowdsourced_feedbacks:", error);
    throw error;
  }
}
