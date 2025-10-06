// utils/queries/simulation_attempts/get-earliest-attempt-date.ts
"use server";
import { createMockableAction } from "@/lib/testing/create-mockable-action";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { sql } from "drizzle-orm";

// Original logic is now a "private" function
async function _getEarliestAttemptDate() {
  try {
    const result = await db
      .select({
        earliestDate: sql<string>`MIN(${simulationAttempts.createdAt})`,
      })
      .from(simulationAttempts);

    const earliestDate = result[0]?.earliestDate;
    return earliestDate ? new Date(earliestDate) : null;
  } catch (error) {
    await log.error("query.fetch_earliest_date.failed", {
      message: "Error fetching earliest attempt date",
      subject: { entityType: "simulation_attempts" },
      context: {
        function: "_getEarliestAttemptDate",
        file: "utils/queries/simulation_attempts/get-earliest-attempt-date.ts",
      },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getEarliestAttemptDate = createMockableAction(
  "getEarliestAttemptDate",
  _getEarliestAttemptDate,
);
