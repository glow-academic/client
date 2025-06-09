// utils/queries/attempts/get-attempts-by-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getAttemptsByClass(classId: string) {
  try {
    return await db.select().from(attempts).where(eq(attempts.classId, classId));
  } catch (error) {
    console.error("Error fetching attempts by class:", error);
    throw error;
  }
}
