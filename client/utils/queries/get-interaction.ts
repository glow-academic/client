"use server";
import { db } from "@/utils/drizzle/database";
import { interactions } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getInteraction(interactionId: string) {
  const interaction = await db
    .select()
    .from(interactions)
    .where(eq(interactions.id, interactionId))
    .limit(1);
  return interaction[0] || null;
} 