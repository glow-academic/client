import { describe, expect, it, vi } from "vitest";

// Mock next/navigation redirect - define before import to avoid hoisting issues
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import ReportsPage, { metadata } from "@/app/(main)/analytics/reports/p/page";

describe("ReportsPage", () => {
  it("calls redirect to /analytics/reports", () => {
    ReportsPage();
    expect(mockRedirect).toHaveBeenCalledWith("/analytics/reports");
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Reports");
    expect(metadata.description).toContain("Reports in GLOW");
  });
});
