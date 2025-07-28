// utils/mutations/simulation_chat_feedbacks/update-simulation-chat-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatFeedbacks } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateSimulationChatFeedbacks(ids: string[], data: Partial<typeof simulationChatFeedbacks.$inferInsert>) {
  try {
    return await db.update(simulationChatFeedbacks).set(data).where(inArray(simulationChatFeedbacks.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple simulation_chat_feedbacks:", error);
    throw error;
  }
}
