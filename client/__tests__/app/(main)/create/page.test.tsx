import { describe, expect, it, vi } from "vitest";

// Mock next/navigation redirect
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import CreatePage, { metadata } from "@/app/(main)/create/page";

describe("CreatePage", () => {
  it("calls redirect to /create/scenarios", () => {
    CreatePage();
    expect(mockRedirect).toHaveBeenCalledWith("/create/scenarios");
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Create");
    expect(metadata.description).toContain("Create new simulations in GLOW");
  });
});
