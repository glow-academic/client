"use server";
import { db } from "@/utils/drizzle/database";
import { simulations } from "@/drizzle/schema";

export async function getSimulations() {
  const fetchedSimulations = await db.select().from(simulations);
  return fetchedSimulations;
} 