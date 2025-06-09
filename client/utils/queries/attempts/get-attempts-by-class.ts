// utils/queries/attempts/get-attempts-by-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getAttemptsByClass(classIds: string[]) {
  try {
    return await db.select().from(attempts).where(inArray(attempts.classId, classIds));
  } catch (error) {
    console.error("Error fetching attempts by class:", error);
    throw error;
  }
}
