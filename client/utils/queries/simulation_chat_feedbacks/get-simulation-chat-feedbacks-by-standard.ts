// utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-standard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatFeedbacks } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationChatFeedbacksByStandard(standardId: string) {
  try {
    return await db.select().from(simulationChatFeedbacks).where(eq(simulationChatFeedbacks.standardId, standardId));
  } catch (error) {
    console.error("Error fetching simulation_chat_feedbacks by standard:", error);
    throw error;
  }
}
