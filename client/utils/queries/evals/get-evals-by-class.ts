// utils/queries/evals/get-evals-by-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalsByClass(classId: string) {
  try {
    return await db.select().from(evals).where(eq(evals.classId, classId));
  } catch (error) {
    console.error("Error fetching evals by class:", error);
    throw error;
  }
}
