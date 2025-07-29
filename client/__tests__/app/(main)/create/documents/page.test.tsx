import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock Documents component
vi.mock("@/components/create/documents/Documents", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="documents-component">Documents Component</div>
  ),
}));

import DocumentsPage, { metadata } from "@/app/(main)/create/documents/page";

describe("DocumentsPage", () => {
  it("renders without crashing", () => {
    renderWithMocks(<DocumentsPage />);
    expect(screen.getByTestId("documents-component")).toBeInTheDocument();
    expect(screen.getByText("Documents Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Documents");
    expect(metadata.description).toContain("Documents in GLOW");
  });

  it("renders the Documents component inside a wrapper", () => {
    renderWithMocks(<DocumentsPage />);
    const wrapper = screen.getByTestId("documents-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
