// utils/queries/simulation_chats/get-simulation-chats-by-attempt.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationChatsByAttempt(attemptId: string) {
  try {
    return await db.select().from(simulationChats).where(eq(simulationChats.attemptId, attemptId));
  } catch (error) {
    logError("Error fetching simulation_chats by attempt:", error);
    throw error;
  }
}
