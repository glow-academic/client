// utils/queries/simulation_chat_crowdsourced_feedbacks/get-simulation-chat-crowdsourced-feedbacks-by-simulation-chat-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedback(simulationChatFeedbackId: string) {
  try {
    return await db.select().from(simulationChatCrowdsourcedFeedbacks).where(eq(simulationChatCrowdsourcedFeedbacks.simulationChatFeedbackId, simulationChatFeedbackId));
  } catch (error) {
    logError("Error fetching simulation_chat_crowdsourced_feedbacks by simulationChatFeedback:", error);
    throw error;
  }
}
