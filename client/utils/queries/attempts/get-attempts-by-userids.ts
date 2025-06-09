// utils/queries/attempts/get-attempts-by-userids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getAttemptsByUserids(useridIds: string[]) {
  try {
    return await db.select().from(attempts).where(inArray(attempts.user_id, useridIds));
  } catch (error) {
    console.error("Error fetching attempts by userids:", error);
    throw error;
  }
}
