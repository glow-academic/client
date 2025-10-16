/**
 * CohortPicker.test.tsx
 * Tests for the CohortPicker component
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { Cohort, CohortPicker } from "@/components/common/cohort/CohortPicker";
import { fireEvent, render, screen, waitFor } from "@/test/custom-render";
import { describe, expect, it, vi } from "vitest";

const mockCohorts: Cohort[] = [
  {
    id: "cohort-1",
    title: "Test Cohort 1",
    description: "First test cohort",
    memberCount: 10,
  },
  {
    id: "cohort-2",
    title: "Test Cohort 2",
    description: "Second test cohort",
    memberCount: 15,
  },
  {
    id: "cohort-3",
    title: "Test Cohort 3",
    description: "Third test cohort",
    memberCount: 8,
  },
];

describe("CohortPicker", () => {
  it("renders with placeholder text", () => {
    const onSelect = vi.fn();
    render(
      <CohortPicker
        cohorts={mockCohorts}
        onSelect={onSelect}
        selectedCohorts={[]}
      />,
    );

    expect(screen.getByText("Select cohorts...")).toBeInTheDocument();
  });

  it("shows selected cohort when one is selected", () => {
    const onSelect = vi.fn();
    render(
      <CohortPicker
        cohorts={mockCohorts}
        onSelect={onSelect}
        selectedCohorts={[mockCohorts[0]!]}
      />,
    );

    // Check that the cohort appears in the button text
    expect(screen.getByRole("combobox")).toHaveTextContent("Test Cohort 1");
  });

  it("shows count when multiple cohorts are selected", () => {
    const onSelect = vi.fn();
    render(
      <CohortPicker
        cohorts={mockCohorts}
        onSelect={onSelect}
        selectedCohorts={[mockCohorts[0]!, mockCohorts[1]!]}
      />,
    );

    expect(screen.getByText("2 cohorts selected")).toBeInTheDocument();
  });

  it("displays selected chips when cohorts are selected", () => {
    const onSelect = vi.fn();
    render(
      <CohortPicker
        cohorts={mockCohorts}
        onSelect={onSelect}
        selectedCohorts={[mockCohorts[0]!, mockCohorts[1]!]}
        hideSelectedChips={false}
      />,
    );

    expect(screen.getByText("Test Cohort 1")).toBeInTheDocument();
    expect(screen.getByText("Test Cohort 2")).toBeInTheDocument();
  });

  it("opens popover when clicked", async () => {
    const onSelect = vi.fn();
    render(
      <CohortPicker
        cohorts={mockCohorts}
        onSelect={onSelect}
        selectedCohorts={[]}
      />,
    );

    const button = screen.getByRole("combobox");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Test Cohort 1")).toBeInTheDocument();
      expect(screen.getByText("Test Cohort 2")).toBeInTheDocument();
      expect(screen.getByText("Test Cohort 3")).toBeInTheDocument();
    });
  });

  it("calls onSelect when a cohort is selected", async () => {
    const onSelect = vi.fn();
    render(
      <CohortPicker
        cohorts={mockCohorts}
        onSelect={onSelect}
        selectedCohorts={[]}
      />,
    );

    const button = screen.getByRole("combobox");
    fireEvent.click(button);

    await waitFor(() => {
      const cohort1 = screen.getByText("Test Cohort 1");
      fireEvent.click(cohort1);
    });

    expect(onSelect).toHaveBeenCalledWith([mockCohorts[0]!]);
  });

  it("removes cohort when remove button is clicked", () => {
    const onSelect = vi.fn();
    render(
      <CohortPicker
        cohorts={mockCohorts}
        onSelect={onSelect}
        selectedCohorts={[mockCohorts[0]!, mockCohorts[1]!]}
        hideSelectedChips={false}
      />,
    );

    // Find remove buttons by looking for X icons
    const removeButtons = screen.getAllByRole("button").filter((button) => {
      const svg = button.querySelector("svg");
      return svg && svg.classList.contains("h-3");
    });

    if (removeButtons.length > 0) {
      fireEvent.click(removeButtons[0]!);
      expect(onSelect).toHaveBeenCalledWith([mockCohorts[1]!]);
    }
  });
});
