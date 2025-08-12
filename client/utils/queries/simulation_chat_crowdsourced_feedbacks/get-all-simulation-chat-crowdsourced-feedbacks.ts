// utils/queries/simulation_chat_crowdsourced_feedbacks/get-all-simulation-chat-crowdsourced-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllSimulationChatCrowdsourcedFeedbacks() {
  try {
    return await db.select().from(simulationChatCrowdsourcedFeedbacks);
  } catch (error) {
    await log.error("query.fetch_all.failed", {
      message: "Error fetching all simulation_chat_crowdsourced_feedbacks",
      subject: { entityType: "simulation_chat_crowdsourced_feedbacks" },
      context: { function: "_getAllSimulationChatCrowdsourcedFeedbacks", file: "utils/queries/simulation_chat_crowdsourced_feedbacks/get-all-simulation-chat-crowdsourced-feedbacks.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllSimulationChatCrowdsourcedFeedbacks = createMockableAction('getAllSimulationChatCrowdsourcedFeedbacks', _getAllSimulationChatCrowdsourcedFeedbacks);
