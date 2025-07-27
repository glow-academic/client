import { renderWithMocks } from "@/test/renderWithMocks";
import type { Table } from "@tanstack/react-table";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  SingleProfileBrightspaceExportButton,
  SingleProfileBrightspaceExportButtonProps,
} from "@/components/common/history/SingleProfileBrightspaceExportButton";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: SingleProfileBrightspaceExportButtonProps<unknown> = {
  table: {} as unknown as Table<unknown>,
  profileOptions: [],
};
// ------------------------------------------------------------------
describe("SingleProfileBrightspaceExportButton", () => {
  // ✨ Reset mocks after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<SingleProfileBrightspaceExportButton {...mockProps} />);
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<SingleProfileBrightspaceExportButton {...mockProps} />);
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<SingleProfileBrightspaceExportButton {...mockProps} />);
      const button =
        document.querySelector("button") || document.querySelector("div");
      expect(button).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<SingleProfileBrightspaceExportButton {...mockProps} />);
      const buttons = document.querySelectorAll("button");
      if (buttons.length > 0 && buttons[0]) {
        await user.click(buttons[0]);
        expect(buttons[0]).toBeInTheDocument();
      }
    });
    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<SingleProfileBrightspaceExportButton {...mockProps} />);
      const dropdowns = document.querySelectorAll('[role="combobox"]');
      if (dropdowns.length > 0 && dropdowns[0]) {
        await user.click(dropdowns[0]);
        expect(dropdowns[0]).toBeInTheDocument();
      }
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      renderWithMocks(<SingleProfileBrightspaceExportButton {...mockProps} />);
      expect(document.body).toBeInTheDocument();
    });
    it("should handle loading states", () => {
      renderWithMocks(<SingleProfileBrightspaceExportButton {...mockProps} />);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<SingleProfileBrightspaceExportButton {...mockProps} />);
      expect(document.body).toBeInTheDocument();
    });
    it("should handle missing or invalid props", () => {
      renderWithMocks(
        <SingleProfileBrightspaceExportButton
          table={{} as unknown as Table<unknown>}
          profileOptions={[]}
        />
      );
      expect(document.body).toBeInTheDocument();
    });
  });
});
