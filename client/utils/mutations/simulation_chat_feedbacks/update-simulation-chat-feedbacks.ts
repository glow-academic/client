// utils/mutations/simulation_chat_feedbacks/update-simulation-chat-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatFeedbacks } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateSimulationChatFeedbacks(ids: string[], data: Partial<typeof simulationChatFeedbacks.$inferInsert>) {
  try {
    return await db.update(simulationChatFeedbacks).set(data).where(inArray(simulationChatFeedbacks.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple simulation_chat_feedbacks:", error);
    throw error;
  }
}
