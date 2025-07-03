// utils/queries/simulation_sketches/get-simulation-sketches-by-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationSketches } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationSketchesByChats(chatIds: string[]) {
  try {
    return await db.select().from(simulationSketches).where(inArray(simulationSketches.chatId, chatIds));
  } catch (error) {
    logError("Error fetching simulation_sketches by chats:", error);
    throw error;
  }
}
