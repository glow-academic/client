import type { AttemptHistoryRow } from "@/lib/analytics";
import { useMemo } from "react";

// This returns exactly what your DataTable expects for columns,
// but every heavy value (names, badges, counts, score) comes from the API.
export function useHistoryAdapter(rows: AttemptHistoryRow[]) {
  return useMemo(() => {
    const data = rows.map((r) => ({
      id: r.attemptId,
      createdAt: r.attemptDate,
      profileId: r.profileId,
      simulationId: r.simulationId,
      archived: r.archived,
      infiniteMode: r.infiniteMode,
      infiniteModeTimeLimit: r.infiniteModeTimeLimit ?? null,

      // for existing columns:
      scenarios: {
        // you can feed a tiny object if your cell only needs counts
        completedCount: r.completedCount,
        expectedCount: r.expectedCount,
      } as { completedCount: number; expectedCount: number | null },

      personasTested: r.personaNames,
      interactionIds:
        r.expectedCount === null ? [] : new Array(r.expectedCount).fill("x"),

      // optional: stash score for the Score column
      __scorePercent: r.scorePercent,
      __scenarioRootIds: r.scenarioIds,
      __profileName: r.profileName,
      __simulationTitle: r.simulationTitle,
      __personaColors: r.personaColors,
      __showContinue: r.showContinue,
      __showView: r.showView,
    }));

    return { data };
  }, [rows]);
}
