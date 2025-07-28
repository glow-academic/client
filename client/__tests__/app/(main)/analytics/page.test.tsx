import { describe, expect, it, vi } from "vitest";

// Mock next/navigation redirect
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import AnalyticsPage, { metadata } from "@/app/(main)/analytics/page";

describe("AnalyticsPage", () => {
  it("calls redirect to /analytics/dashboard", () => {
    AnalyticsPage();
    expect(mockRedirect).toHaveBeenCalledWith("/analytics/dashboard");
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Analytics");
    expect(metadata.description).toContain("Analytics in GLOW");
  });
});
