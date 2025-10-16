import { redirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

// Import centralized mocks to avoid hoisting issues
import "@/mocks/navigation";

import CreatePage, { metadata } from "@/app/(main)/create/page";

describe("CreatePage", () => {
  it("calls redirect to /create/scenarios", () => {
    CreatePage();
    expect(vi.mocked(redirect)).toHaveBeenCalledWith("/create/scenarios");
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Create");
    expect(metadata.description).toContain("Create new simulations in GLOW");
  });
});
