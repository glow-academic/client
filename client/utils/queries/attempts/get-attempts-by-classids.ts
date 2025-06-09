// utils/queries/attempts/get-attempts-by-classids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getAttemptsByClassids(classidIds: string[]) {
  try {
    return await db.select().from(attempts).where(inArray(attempts.class_id, classidIds));
  } catch (error) {
    console.error("Error fetching attempts by classids:", error);
    throw error;
  }
}
