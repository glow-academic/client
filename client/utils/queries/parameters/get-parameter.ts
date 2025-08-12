// utils/queries/parameters/get-parameter.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getParameter(id: string) {
  try {
    const result = await db.select().from(parameters).where(eq(parameters.id, id));
    return result[0] || null;
  } catch (error) {
    await log.error("query.fetch_one.failed", {
      message: "Error fetching parameter",
      subject: { entityType: "parameters", entityId: String(id) },
      context: { function: "_getParameter", file: "utils/queries/parameters/get-parameter.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getParameter = createMockableAction('getParameter', _getParameter);
