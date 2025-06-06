"use server";
import { db } from "@/utils/drizzle/database";
import { interactions } from "@/drizzle/schema";

export async function getInteractions() {
  const fetchedInteractions = await db.select().from(interactions);
  return fetchedInteractions;
} 