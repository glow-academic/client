// utils/queries/get-scenarios.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { scenarios } from "@/drizzle/schema";

export async function getScenarios() {
    const fetchedScenarios = await db.select().from(scenarios);
    return fetchedScenarios;
}
