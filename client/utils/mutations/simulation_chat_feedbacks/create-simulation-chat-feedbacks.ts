// utils/mutations/simulation_chat_feedbacks/create-simulation-chat-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatFeedbacks } from "@/drizzle/schema";

export async function createSimulationChatFeedbacks(
  data: (typeof simulationChatFeedbacks.$inferInsert)[],
) {
  try {
    return await db.insert(simulationChatFeedbacks).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple simulation_chat_feedbacks:", error);
    throw error;
  }
}
