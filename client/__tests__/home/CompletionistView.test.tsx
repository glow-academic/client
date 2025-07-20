import CompletionistView from "@/components/home/CompletionistView";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("CompletionistView", () => {
  const mockData = {
    percentage: 75,
    actionItems: [
      { id: "1", title: "Test Cohort 1" },
      { id: "2", title: "Test Cohort 2" },
    ],
  };

  const mockProfile = {
    id: "1",
    firstName: "John",
    lastName: "Doe",
    role: "ta" as const,
    // Add other required profile fields
    createdAt: "",
    updatedAt: "",
    active: true,
    userId: null,
    lastLogin: "",
    alias: "",
    viewedIntro: false,
    defaultProfile: false,
    lastActive: "",
  };

  it("renders completion percentage correctly", () => {
    render(<CompletionistView data={mockData} profile={mockProfile} />);

    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("Overall Completion")).toBeInTheDocument();
  });

  it("renders greeting with user name", () => {
    render(<CompletionistView data={mockData} profile={mockProfile} />);

    expect(screen.getByText("Welcome back, John!")).toBeInTheDocument();
  });

  it("renders action items for TA role", () => {
    render(<CompletionistView data={mockData} profile={mockProfile} />);

    expect(screen.getByText("Review Test Cohort 1")).toBeInTheDocument();
    expect(screen.getByText("Review Test Cohort 2")).toBeInTheDocument();
  });

  it("renders empty state when no action items", () => {
    const emptyData = { percentage: 100, actionItems: [] };
    render(<CompletionistView data={emptyData} profile={mockProfile} />);

    expect(
      screen.getByText("🎉 Everything is complete. Great work!")
    ).toBeInTheDocument();
  });
});
