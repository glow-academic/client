// utils/queries/simulation_sketches/get-simulation-sketches-by-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationSketches } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationSketchesByChat(chatId: string) {
  try {
    return await db.select().from(simulationSketches).where(eq(simulationSketches.chatId, chatId));
  } catch (error) {
    logError("Error fetching simulation_sketches by chat:", error);
    throw error;
  }
}
