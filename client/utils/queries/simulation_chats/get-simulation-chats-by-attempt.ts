// utils/queries/simulation_chats/get-simulation-chats-by-attempt.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationChatsByAttempt(attemptId: string) {
  try {
    return await db.select().from(simulationChats).where(eq(simulationChats.attempt_id, attemptId));
  } catch (error) {
    console.error("Error fetching simulation_chats by attempt:", error);
    throw error;
  }
}
