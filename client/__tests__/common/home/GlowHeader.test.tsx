import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import GlowHeader from "@/components/common/home/GlowHeader";

describe("GlowHeader", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<GlowHeader />);

      // Should render the GLOW header
      await waitFor(() => {
        expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
      });
    });

    it("should render header content", async () => {
      renderWithMocks(<GlowHeader />);

      await waitFor(() => {
        expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
        expect(screen.getByText(/intelligent assistant/i)).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<GlowHeader />);

      await waitFor(() => {
        // Check for header element
        const header = screen.getByText("GLOW Assistant").closest("div");
        expect(header).toBeInTheDocument();

        // Check for proper heading structure
        expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      renderWithMocks(<GlowHeader />);

      await waitFor(() => {
        expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
      });

      // Should render properly even with no props
      expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
    });
  });
});
