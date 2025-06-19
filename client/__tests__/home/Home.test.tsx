/**
 * tests/pages/Home.spec.tsx
 * Vitest + React-Testing-Library
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Home from "@/components/home/Home";
import { renderWithProviders } from "@/mocks/utils";

/* -------------------------------------------------------------------------- */
/* Helpers – pull the generated stubs we want to tweak on a per-test basis    */
/* -------------------------------------------------------------------------- */
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";

/* The mocks in client/mocks/queries.ts return                */
/* mockSchema.simulations | []     etc.                       */
/* For most tests that’s fine.  When we need custom data we   */
/* just patch the already-mocked fn here with mockResolvedValue. */

const soloSim = {
  id: "sim-solo-1",
  title: "Solo Practice",
  scenarioIds: ["scenario-1"],
  timeLimit: 20,
  createdAt: "2025-01-01T00:00:00Z",
  active: true,
  rubricId: "rubric-1",
  updatedAt: "2025-01-01T00:00:00Z",
  cohortIds: ["cohort-1"],
  defaultSimulation: false,
};

const multiSim = {
  id: "sim-multi-1",
  title: "Multi Challenge",
  scenarioIds: ["scenario-1", "scenario-2"],
  timeLimit: 45,
  createdAt: "2025-01-01T00:00:00Z",
  active: true,
  rubricId: "rubric-1",
  updatedAt: "2025-01-01T00:00:00Z",
  cohortIds: ["cohort-1"],
  defaultSimulation: false,
};

/* -------------------------------------------------------------------------- */
/* Global reset between specs                                                 */
/* -------------------------------------------------------------------------- */
beforeEach(() => {
  vi.clearAllMocks(); // resets call counts
  vi.resetModules(); // restores original auto-mock return values
});

/* -------------------------------------------------------------------------- */
/* Specs                                                                      */
/* -------------------------------------------------------------------------- */
describe("Home page", () => {
  it("renders loading skeletons while simulations are fetching", () => {
    // Return a never-resolving promise → keeps query in 'loading'
    vi.mocked(getAllSimulations).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders(<Home />);

    // 6 skeleton cards on first paint
    expect(document.querySelectorAll(".animate-pulse")).toHaveLength(6);
  });

  it("shows solo and multi simulations once data arrives", async () => {
    vi.mocked(getAllSimulations).mockResolvedValue([soloSim, multiSim]);

    renderWithProviders(<Home />);

    await screen.findByText("Solo Simulations");
    expect(screen.getByText("Solo Practice")).toBeInTheDocument();
    expect(screen.getByText("Multi Challenge")).toBeInTheDocument();
  });

  it("starts a simulation when the card is clicked", async () => {
    vi.mocked(getAllSimulations).mockResolvedValue([soloSim]);

    const user = userEvent.setup();
    renderWithProviders(<Home />);

    // Wait for card
    const card = await screen.findByTestId("permanent-simulation-card");
    await user.click(card);

    // The button inside the card enters the “Starting…” state
    expect(card).toHaveClass("animate-pulse");
  });

  it("shows ‘No simulations’ when API returns empty array", async () => {
    vi.mocked(getAllSimulations).mockResolvedValue([]);

    renderWithProviders(<Home />);

    await screen.findByText("No simulations available");
    expect(
      screen.getByText("Contact an administrator to add simulations.")
    ).toBeInTheDocument();
  });

  it("classifies sims correctly (solo vs multi)", async () => {
    vi.mocked(getAllSimulations).mockResolvedValue([soloSim, multiSim]);

    renderWithProviders(<Home />);

    const soloLabel = await screen.findByText("1 session");
    const multiLabel = await screen.findByText("2 sessions");

    expect(soloLabel).toBeInTheDocument();
    expect(multiLabel).toBeInTheDocument();
  });
});
