// utils/queries/simulation_chats/get-simulation-chats-by-attemptid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationChatsByAttemptid(attemptidId: string) {
  try {
    return await db.select().from(simulationChats).where(eq(simulationChats.attempt_id, attemptidId));
  } catch (error) {
    console.error("Error fetching simulation_chats by attemptid:", error);
    throw error;
  }
}
