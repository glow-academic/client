// utils/queries/evals/get-evals-by-classids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalsByClassids(classidIds: string[]) {
  try {
    return await db.select().from(evals).where(inArray(evals.class_id, classidIds));
  } catch (error) {
    console.error("Error fetching evals by classids:", error);
    throw error;
  }
}
