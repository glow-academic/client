// utils/mutations/simulation_chat_rubrics/delete-simulation-chat-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatRubrics } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteSimulationChatRubrics(ids: string[]) {
  try {
    return await db.delete(simulationChatRubrics).where(inArray(simulationChatRubrics.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple simulation_chat_rubrics:", error);
    throw error;
  }
}
