// utils/queries/get-scenario.ts
"use server";
import { eq } from "drizzle-orm";
import { scenarios } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function getScenario(scenarioId: string) {
    const scenario = await db
        .select()
        .from(scenarios)
        .where(eq(scenarios.id, scenarioId))
        .limit(1);
    return scenario[0] || null;
}
