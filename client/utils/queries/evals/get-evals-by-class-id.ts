// utils/queries/evals/get-evals-by-classid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalsByClassid(classidId: string) {
  try {
    return await db.select().from(evals).where(eq(evals.class_id, classidId));
  } catch (error) {
    console.error("Error fetching evals by classid:", error);
    throw error;
  }
}
