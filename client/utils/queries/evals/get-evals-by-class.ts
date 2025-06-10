// utils/queries/evals/get-evals-by-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalsByClass(classIds: string[]) {
  try {
    return await db
      .select()
      .from(evals)
      .where(inArray(evals.classId, classIds));
  } catch (error) {
    console.error("Error fetching evals by class:", error);
    throw error;
  }
}
