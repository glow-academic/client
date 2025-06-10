// utils/mutations/simulation_chat_feedbacks/delete-simulation-chat-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatFeedbacks } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteSimulationChatFeedbacks(ids: string[]) {
  try {
    return await db
      .delete(simulationChatFeedbacks)
      .where(inArray(simulationChatFeedbacks.id, ids))
      .returning();
  } catch (error) {
    console.error("Error deleting multiple simulation_chat_feedbacks:", error);
    throw error;
  }
}
