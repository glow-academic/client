// utils/queries/agents/get-agents-by-standardGroups.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { agents } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getAgentsByStandardGroups(standardGroupIds: string[]) {
  try {
    return await db.select().from(agents).where(inArray(agents.standardGroupId, standardGroupIds));
  } catch (error) {
    console.error("Error fetching agents by standardGroups:", error);
    throw error;
  }
}
