import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it, vi } from "vitest";

// Mock Logs component
vi.mock("@/components/system/logs/Logs", () => ({
  __esModule: true,
  default: () => <div data-testid="logs-component">Logs Component</div>,
}));

import LogsPage, { metadata } from "@/app/(main)/system/logs/page";

describe("LogsPage", () => {
  it("renders without crashing", () => {
    render(<LogsPage />);
    expect(screen.getByTestId("logs-component")).toBeInTheDocument();
    expect(screen.getByText("Logs Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("System");
    expect(metadata.description).toContain("Manage system in GLOW");
  });

  it("renders the Logs component inside a wrapper", () => {
    render(<LogsPage />);
    const wrapper = screen.getByTestId("logs-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
