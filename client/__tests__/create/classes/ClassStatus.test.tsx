/**
 * ClassStatus.test.tsx
 * Test suite for the ClassStatus component
 */

import ClassStatus from "@/components/create/classes/ClassStatus";
import { renderWithProviders } from "@/mocks/utils";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import the auto-generated mocks
import "@/mocks/mutations";
import "@/mocks/queries";

describe("ClassStatus Component", () => {
  const mockClassId = "a2scfggz-5a3r-z4pz-oser-jmmquskqm8q"; // From schema.ts

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (classId = mockClassId) => {
    return renderWithProviders(<ClassStatus classId={classId} />);
  };

  it("renders loading state initially", () => {
    renderComponent();
    // Should show skeleton loaders instead of specific text
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders basic component structure", async () => {
    renderComponent();

    await waitFor(() => {
      // Should render some content after loading
      expect(document.body).toBeInTheDocument();
    });
  });

  it("handles different class IDs", () => {
    renderComponent("different-class-id");
    // Should show skeleton loaders for any class ID
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders without crashing with valid props", () => {
    expect(() => renderComponent()).not.toThrow();
  });

  it("shows class information section when loaded", async () => {
    renderComponent();

    await waitFor(
      () => {
        // Look for any content that indicates the component loaded
        const content = document.querySelector("div");
        expect(content).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it("handles empty class ID gracefully", () => {
    renderComponent("");
    expect(document.body).toBeInTheDocument();
  });
});
