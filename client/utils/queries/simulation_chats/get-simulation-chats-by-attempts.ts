// utils/queries/simulation_chats/get-simulation-chats-by-attempts.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationChatsByAttempts(attemptIds: string[]) {
  try {
    return await db.select().from(simulationChats).where(inArray(simulationChats.attemptId, attemptIds));
  } catch (error) {
    logError("Error fetching simulation_chats by attempts:", error);
    throw error;
  }
}
