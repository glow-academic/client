// utils/queries/evals/get-all-evals.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";

export async function getAllEvals() {
  try {
    return await db.select().from(evals);
  } catch (error) {
    console.error("Error fetching all evals:", error);
    throw error;
  }
}
