// utils/queries/agents/get-all-agents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { agents } from "@/drizzle/schema";

export async function getAllAgents() {
  try {
    return await db.select().from(agents);
  } catch (error) {
    console.error("Error fetching all agents:", error);
    throw error;
  }
}
