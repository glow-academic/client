// utils/queries/simulation_chat_crowdsourced_feedbacks/get-simulation-chat-crowdsourced-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationChatCrowdsourcedFeedback(id: string) {
  try {
    const result = await db.select().from(simulationChatCrowdsourcedFeedbacks).where(eq(simulationChatCrowdsourcedFeedbacks.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching simulationChatCrowdsourcedFeedback:", error);
    throw error;
  }
}
