// utils/queries/attempts/get-attempts-by-userid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getAttemptsByUserid(useridId: string) {
  try {
    return await db.select().from(attempts).where(eq(attempts.user_id, useridId));
  } catch (error) {
    console.error("Error fetching attempts by userid:", error);
    throw error;
  }
}
