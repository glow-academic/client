// utils/mutations/simulation_chat_crowdsourced_feedbacks/delete-simulation-chat-crowdsourced-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSimulationChatCrowdsourcedFeedback(id: string) {
  try {
    const result = await db.delete(simulationChatCrowdsourcedFeedbacks).where(eq(simulationChatCrowdsourcedFeedbacks.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting simulationChatCrowdsourcedFeedback:", error);
    throw error;
  }
}
