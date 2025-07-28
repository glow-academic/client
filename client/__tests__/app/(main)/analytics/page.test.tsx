import { redirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

// Import centralized mocks to avoid hoisting issues
import "@/mocks/navigation";

import AnalyticsPage, { metadata } from "@/app/(main)/analytics/page";

describe("AnalyticsPage", () => {
  it("calls redirect to /analytics/dashboard", () => {
    AnalyticsPage();
    expect(vi.mocked(redirect)).toHaveBeenCalledWith("/analytics/dashboard");
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Analytics");
    expect(metadata.description).toContain("Analytics in GLOW");
  });
});
