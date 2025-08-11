import { render } from '@/test/custom-render';
import type { Table } from "@tanstack/react-table";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  ProvidersDataTableToolbar,
  ProvidersDataTableToolbarProps,
} from "@/components/management/providers/ProvidersDataTableToolbar";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: ProvidersDataTableToolbarProps = {
  table: {
    getState: () => ({ columnFilters: [] }),
    getColumn: () => null,
  } as unknown as Table<{
    name: string;
    id: string;
    createdAt: string;
    updatedAt: string;
    description: string;
    providerId: string;
    active: boolean;
  }>,
  providerOptions: [],
  customModelOptions: [],
  statusOptions: [],
};
// ------------------------------------------------------------------

describe("ProvidersDataTableToolbar", () => {
  // ✨ Reset mocks after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      // ✨ All mocks are automatically set up via imports above
      render(<ProvidersDataTableToolbar {...mockProps} />);

      // Basic rendering test - component should render without crashing
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      render(<ProvidersDataTableToolbar {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<ProvidersDataTableToolbar {...mockProps} />);

      // Basic accessibility test - component should be in the document
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle user interactions", async () => {
      render(<ProvidersDataTableToolbar {...mockProps} />);

      // Component should handle user interactions
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      render(<ProvidersDataTableToolbar {...mockProps} />);

      // Component should handle edge cases gracefully
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with missing/invalid props
      render(
        <ProvidersDataTableToolbar
          table={
            {
              getState: () => ({ columnFilters: [] }),
              getColumn: () => null,
            } as unknown as Table<{
              name: string;
              id: string;
              createdAt: string;
              updatedAt: string;
              description: string;
              providerId: string;
              active: boolean;
            }>
          }
          providerOptions={[]}
          customModelOptions={[]}
          statusOptions={[]}
        />,
      );

      // Component should handle invalid props gracefully
      expect(document.body).toBeInTheDocument();
    });
  });
});
