import { redirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

// Import centralized mocks to avoid hoisting issues
import "@/mocks/navigation";

import AnalyticsReportsPage, {
  metadata,
} from "@/app/(main)/analytics/reports/p/page";

describe("AnalyticsReportsPage", () => {
  it("calls redirect to /analytics/reports", () => {
    AnalyticsReportsPage();
    expect(vi.mocked(redirect)).toHaveBeenCalledWith("/analytics/reports");
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Reports");
    expect(metadata.description).toContain("Reports in GLOW");
  });
});
