// utils/queries/simulation_chat_crowdsourced_feedbacks/get-simulation-chat-crowdsourced-feedbacks-by-profile.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatCrowdsourcedFeedbacksByProfile(profileId: string) {
  try {
    return await db.select().from(simulationChatCrowdsourcedFeedbacks).where(eq(simulationChatCrowdsourcedFeedbacks.profileId, profileId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching simulation_chat_crowdsourced_feedbacks by profile",
      subject: { entityType: "simulation_chat_crowdsourced_feedbacks" },
      context: { function: "_getSimulationChatCrowdsourcedFeedbacksByProfile", file: "utils/queries/simulation_chat_crowdsourced_feedbacks/get-simulation-chat-crowdsourced-feedbacks-by-profile.ts", foreignKey: "profileId", foreignId: String(profileId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatCrowdsourcedFeedbacksByProfile = createMockableAction('getSimulationChatCrowdsourcedFeedbacksByProfile', _getSimulationChatCrowdsourcedFeedbacksByProfile);
