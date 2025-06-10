// utils/mutations/simulation_chat_feedbacks/create-simulation-chat-feedback.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatFeedbacks } from "@/drizzle/schema";

export async function createSimulationChatFeedback(data: typeof simulationChatFeedbacks.$inferInsert) {
  try {
    const result = await db.insert(simulationChatFeedbacks).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating simulationChatFeedback:", error);
    throw error;
  }
}
