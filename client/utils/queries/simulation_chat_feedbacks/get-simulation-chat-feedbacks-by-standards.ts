// utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-standards.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatFeedbacks } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationChatFeedbacksByStandards(standardIds: string[]) {
  try {
    return await db.select().from(simulationChatFeedbacks).where(inArray(simulationChatFeedbacks.standardId, standardIds));
  } catch (error) {
    logError("Error fetching simulation_chat_feedbacks by standards:", error);
    throw error;
  }
}
