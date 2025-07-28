import { describe, expect, it, vi } from "vitest";

// Mock next/navigation redirect
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import ManagementPage, { metadata } from "@/app/(main)/management/page";

describe("ManagementPage", () => {
  it("calls redirect to /management/staff", () => {
    ManagementPage();
    expect(mockRedirect).toHaveBeenCalledWith("/management/staff");
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Management");
    expect(metadata.description).toContain(
      "Manage cohorts, evals, logs, models, and staff in GLOW"
    );
  });
});
