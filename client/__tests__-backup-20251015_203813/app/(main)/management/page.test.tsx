import { redirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

// Import centralized mocks to avoid hoisting issues
import "@/mocks/navigation";

import ManagementPage, { metadata } from "@/app/(main)/management/page";

describe("ManagementPage", () => {
  it("calls redirect to /management/staff", () => {
    ManagementPage();
    expect(vi.mocked(redirect)).toHaveBeenCalledWith("/management/staff");
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Management");
    expect(metadata.description).toContain(
      "Manage cohorts, evals, logs, models, and staff in GLOW",
    );
  });
});
