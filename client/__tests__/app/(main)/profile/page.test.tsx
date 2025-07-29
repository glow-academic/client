import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock Profile component
vi.mock("@/components/profile/Profile", () => ({
  __esModule: true,
  Profile: () => <div data-testid="profile-component">Profile Component</div>,
}));

import ProfilePage, { metadata } from "@/app/(main)/profile/page";

describe("ProfilePage", () => {
  it("renders without crashing", () => {
    renderWithMocks(<ProfilePage />);
    expect(screen.getByTestId("profile-component")).toBeInTheDocument();
    expect(screen.getByText("Profile Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Profile");
    expect(metadata.description).toContain("View your profile in GLOW");
  });

  it("renders the Profile component inside a wrapper", () => {
    renderWithMocks(<ProfilePage />);
    const wrapper = screen.getByTestId("profile-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
