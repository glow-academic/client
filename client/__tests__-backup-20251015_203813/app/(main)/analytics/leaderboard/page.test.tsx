import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it, vi } from "vitest";

// Mock Leaderboard component
vi.mock("@/components/analytics/Leaderboard", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="leaderboard-component">Leaderboard Component</div>
  ),
}));

import LeaderboardPage, {
  metadata,
} from "@/app/(main)/analytics/leaderboard/page";

describe("LeaderboardPage", () => {
  it("renders without crashing", () => {
    render(<LeaderboardPage />);
    expect(screen.getByTestId("leaderboard-component")).toBeInTheDocument();
    expect(screen.getByText("Leaderboard Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Leaderboard");
    expect(metadata.description).toContain("Leaderboard in GLOW");
  });

  it("renders the Leaderboard component inside a wrapper", () => {
    render(<LeaderboardPage />);
    const wrapper = screen.getByTestId("leaderboard-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
