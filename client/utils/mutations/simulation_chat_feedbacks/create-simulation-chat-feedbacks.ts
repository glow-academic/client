// utils/mutations/simulation_chat_feedbacks/create-simulation-chat-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatFeedbacks } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createSimulationChatFeedbacks(data: (typeof simulationChatFeedbacks.$inferInsert)[]) {
  try {
    return await db.insert(simulationChatFeedbacks).values(data).returning();
  } catch (error) {
    logError("Error creating multiple simulation_chat_feedbacks:", error);
    throw error;
  }
}
