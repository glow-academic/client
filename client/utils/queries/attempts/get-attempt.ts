// utils/queries/attempts/get-attempt.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getAttempt(id: string) {
  try {
    const result = await db.select().from(attempts).where(eq(attempts.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching attempt:", error);
    throw error;
  }
}
