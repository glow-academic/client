// utils/queries/simulation_chat_crowdsourced_feedbacks/get-simulation-chat-crowdsourced-feedbacks-by-profiles.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatCrowdsourcedFeedbacksByProfiles(profileIds: string[]) {
  try {
    return await db.select().from(simulationChatCrowdsourcedFeedbacks).where(inArray(simulationChatCrowdsourcedFeedbacks.profileId, profileIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching simulation_chat_crowdsourced_feedbacks by profiles",
      subject: { entityType: "simulation_chat_crowdsourced_feedbacks" },
      context: { function: "_getSimulationChatCrowdsourcedFeedbacksByProfiles", file: "utils/queries/simulation_chat_crowdsourced_feedbacks/get-simulation-chat-crowdsourced-feedbacks-by-profiles.ts", foreignKey: "profileId", foreignIdsCount: profileIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatCrowdsourcedFeedbacksByProfiles = createMockableAction('getSimulationChatCrowdsourcedFeedbacksByProfiles', _getSimulationChatCrowdsourcedFeedbacksByProfiles);
