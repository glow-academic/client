// utils/queries/simulation_chats/get-simulation-chats-by-attemptids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationChatsByAttemptids(attemptidIds: string[]) {
  try {
    return await db.select().from(simulationChats).where(inArray(simulationChats.attempt_id, attemptidIds));
  } catch (error) {
    console.error("Error fetching simulation_chats by attemptids:", error);
    throw error;
  }
}
