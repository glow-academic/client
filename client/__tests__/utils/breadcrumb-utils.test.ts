import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateBreadcrumbs,
  generateEnhancedBreadcrumbs,
  getActiveSectionFromPath,
} from "@/utils/breadcrumb-utils";

// Mock the query functions
vi.mock("@/utils/queries/classes/get-class", () => ({
  getClass: vi.fn(() => Promise.resolve({ classCode: "CS101" })),
}));

vi.mock("@/utils/queries/scenarios/get-scenario", () => ({
  getScenario: vi.fn(() => Promise.resolve({ name: "Test Scenario" })),
}));

vi.mock("@/utils/queries/agents/get-agent", () => ({
  getAgent: vi.fn(() => Promise.resolve({ name: "Test Agent" })),
}));

vi.mock("@/utils/queries/simulations/get-simulation", () => ({
  getSimulation: vi.fn(() => Promise.resolve({ title: "Test Simulation" })),
}));

vi.mock("@/utils/queries/simulation_attempts/get-simulationAttempt", () => ({
  getSimulationAttempt: vi.fn(() =>
    Promise.resolve({ simulationId: "sim-123" }),
  ),
}));

vi.mock("@/utils/queries/simulation_chats/get-simulationChat", () => ({
  getSimulationChat: vi.fn(() => Promise.resolve({ title: "Test Chat" })),
}));

vi.mock("@/utils/queries/users/get-user", () => ({
  getUser: vi.fn(() => Promise.resolve({ name: "John Doe" })),
}));

vi.mock("@/utils/queries/rubrics/get-rubric", () => ({
  getRubric: vi.fn(() => Promise.resolve({ name: "Test Rubric" })),
}));

vi.mock("@/utils/queries/evals/get-eval", () => ({
  getEval: vi.fn(() => Promise.resolve({ name: "Test Evaluation" })),
}));

describe("breadcrumb-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateBreadcrumbs (synchronous)", () => {
    it("should handle main routes correctly", () => {
      const testCases = [
        { path: "/home", expected: [{ title: "Home", section: "home" }] },
        { path: "/growth", expected: [{ title: "Growth", section: "growth" }] },
        {
          path: "/profile",
          expected: [{ title: "Profile", section: "profile" }],
        },
        { path: "/create", expected: [{ title: "Create", section: "create" }] },
      ];

      testCases.forEach(({ path, expected }) => {
        const result = generateBreadcrumbs(path);
        expect(result).toEqual(expected);
      });
    });

    it("should handle analytics routes correctly", () => {
      const testCases = [
        {
          path: "/analytics/overview",
          expected: [
            { title: "Analytics", section: "analytics" },
            { title: "Overview", section: "overview" },
          ],
        },
        {
          path: "/analytics/performance",
          expected: [
            { title: "Analytics", section: "analytics" },
            { title: "Performance", section: "performance" },
          ],
        },
        {
          path: "/analytics/reports",
          expected: [
            { title: "Analytics", section: "analytics" },
            { title: "Reports", section: "reports" },
          ],
        },
        {
          path: "/analytics/logs",
          expected: [
            { title: "Analytics", section: "analytics" },
            { title: "Logs", section: "logs" },
          ],
        },
      ];

      testCases.forEach(({ path, expected }) => {
        const result = generateBreadcrumbs(path);
        expect(result).toEqual(expected);
      });
    });

    it("should handle create routes correctly", () => {
      const testCases = [
        {
          path: "/create/scenarios",
          expected: [
            { title: "Create", section: "create" },
            { title: "Scenarios", section: "scenarios" },
          ],
        },
        {
          path: "/create/simulations",
          expected: [
            { title: "Create", section: "create" },
            { title: "Simulations", section: "simulations" },
          ],
        },
        {
          path: "/create/rubrics",
          expected: [
            { title: "Create", section: "create" },
            { title: "Rubrics", section: "rubrics" },
          ],
        },
      ];

      testCases.forEach(({ path, expected }) => {
        const result = generateBreadcrumbs(path);
        expect(result).toEqual(expected);
      });
    });

    it("should handle management routes correctly", () => {
      const testCases = [
        {
          path: "/management/staff",
          expected: [
            { title: "Management", section: "management" },
            { title: "Staff", section: "staff" },
          ],
        },
        {
          path: "/management/classes",
          expected: [
            { title: "Management", section: "management" },
            { title: "Classes", section: "classes" },
          ],
        },
        {
          path: "/management/agents",
          expected: [
            { title: "Management", section: "management" },
            { title: "Agents", section: "agents" },
          ],
        },
        {
          path: "/management/evals",
          expected: [
            { title: "Management", section: "management" },
            { title: "Evaluations", section: "evals" },
          ],
        },
      ];

      testCases.forEach(({ path, expected }) => {
        const result = generateBreadcrumbs(path);
        expect(result).toEqual(expected);
      });
    });

    it("should handle class routes correctly", () => {
      const testCases = [
        {
          path: "/classes",
          expected: [{ title: "Classes", section: "classes" }],
        },
        {
          path: "/classes/c/class-123",
          expected: [
            { title: "Classes", section: "classes" },
            { title: "Class-123", section: "class-class-123" },
          ],
        },
        {
          path: "/classes/c/class-123/edit",
          expected: [
            { title: "Classes", section: "classes" },
            { title: "Class-123", section: "class-class-123" },
            { title: "Edit", section: "class-class-123" },
          ],
        },
      ];

      testCases.forEach(({ path, expected }) => {
        const result = generateBreadcrumbs(path);
        expect(result).toEqual(expected);
      });
    });

    it("should handle dynamic ID routes correctly", () => {
      const testCases = [
        {
          path: "/c/chat-123456789012",
          expected: [
            { title: "chat-123...", section: "chat-chat-123456789012" },
          ],
        },
        {
          path: "/a/attempt-123456789012",
          expected: [
            { title: "attempt-...", section: "attempt-attempt-123456789012" },
          ],
        },
        {
          path: "/e/eval-123456789012",
          expected: [
            { title: "eval-123...", section: "eval-eval-123456789012" },
          ],
        },
      ];

      testCases.forEach(({ path, expected }) => {
        const result = generateBreadcrumbs(path);
        expect(result).toEqual(expected);
      });
    });

    it("should skip single letter segments", () => {
      const result = generateBreadcrumbs("/classes/c/class-123");
      expect(result).toEqual([
        { title: "Classes", section: "classes" },
        { title: "Class-123", section: "class-class-123" },
      ]);
      // Should not include 'c' segment
      expect(result.find((item) => item.title === "c")).toBeUndefined();
    });

    it("should handle new/edit actions", () => {
      const testCases = [
        {
          path: "/create/scenarios/new",
          expected: [
            { title: "Create", section: "create" },
            { title: "Scenarios", section: "scenarios" },
            { title: "New", section: "scenarios" },
          ],
        },
        {
          path: "/management/staff/new",
          expected: [
            { title: "Management", section: "management" },
            { title: "Staff", section: "staff" },
            { title: "New", section: "staff" },
          ],
        },
      ];

      testCases.forEach(({ path, expected }) => {
        const result = generateBreadcrumbs(path);
        expect(result).toEqual(expected);
      });
    });
  });

  describe("generateEnhancedBreadcrumbs (async)", () => {
    it("should resolve class IDs to class codes", async () => {
      const result = await generateEnhancedBreadcrumbs(
        "/classes/c/class-123456789012",
      );
      expect(result).toEqual([
        { title: "Classes", section: "classes" },
        { title: "CS101", section: "class-class-123456789012" },
      ]);
    });

    it("should resolve scenario IDs to scenario names", async () => {
      const result = await generateEnhancedBreadcrumbs(
        "/create/scenarios/s/scenario-123456789012",
      );
      expect(result).toEqual([
        { title: "Create", section: "create" },
        { title: "Scenarios", section: "scenarios" },
        { title: "Test Scenario", section: "scenario-scenario-123456789012" },
      ]);
    });

    it("should resolve agent IDs to agent names", async () => {
      const result = await generateEnhancedBreadcrumbs(
        "/management/agents/a/agent-123456789012",
      );
      expect(result).toEqual([
        { title: "Management", section: "management" },
        { title: "Agents", section: "agents" },
        { title: "Test Agent", section: "agent-agent-123456789012" },
      ]);
    });

    it("should resolve simulation IDs to simulation titles", async () => {
      const result = await generateEnhancedBreadcrumbs(
        "/create/simulations/s/sim-123456789012",
      );
      expect(result).toEqual([
        { title: "Create", section: "create" },
        { title: "Simulations", section: "simulations" },
        { title: "Test Simulation", section: "simulation-sim-123456789012" },
      ]);
    });

    it("should resolve chat IDs to chat titles", async () => {
      const result = await generateEnhancedBreadcrumbs("/c/chat-123456789012");
      expect(result).toEqual([
        { title: "Test Chat", section: "chat-chat-123456789012" },
      ]);
    });

    it("should resolve user IDs to user names", async () => {
      const result = await generateEnhancedBreadcrumbs(
        "/management/staff/u/user-123456789012",
      );
      expect(result).toEqual([
        { title: "Management", section: "management" },
        { title: "Staff", section: "staff" },
        { title: "John Doe", section: "user-user-123456789012" },
      ]);
    });

    it("should handle API errors gracefully", async () => {
      // Mock API error
      const { getClass } = await import("@/utils/queries/classes/get-class");
      (getClass as any).mockRejectedValueOnce(new Error("API Error"));

      const result = await generateEnhancedBreadcrumbs(
        "/classes/c/class-123456789012",
      );
      expect(result).toEqual([
        { title: "Classes", section: "classes" },
        { title: "class-12...", section: "class-class-123456789012" },
      ]);
    });
  });

  describe("getActiveSectionFromPath", () => {
    it("should return correct sections for various paths", () => {
      const testCases = [
        { path: "/home", expected: "home" },
        { path: "/growth", expected: "growth" },
        { path: "/analytics/performance", expected: "performance" },
        { path: "/create/scenarios", expected: "scenarios" },
        { path: "/management/staff", expected: "staff" },
        { path: "/classes/c/class-123", expected: "class-class-123" },
        { path: "/c/chat-123", expected: "chat-chat-123" },
        { path: "/a/attempt-123", expected: "attempt-attempt-123" },
        { path: "/e/eval-123", expected: "eval-eval-123" },
        { path: "/profile", expected: "profile" },
      ];

      testCases.forEach(({ path, expected }) => {
        const result = getActiveSectionFromPath(path);
        expect(result).toBe(expected);
      });
    });

    it("should handle empty path", () => {
      const result = getActiveSectionFromPath("");
      expect(result).toBe("dashboard");
    });

    it("should handle root path", () => {
      const result = getActiveSectionFromPath("/");
      expect(result).toBe("dashboard");
    });
  });

  describe("Edge cases", () => {
    it("should handle paths with trailing slashes", () => {
      const result = generateBreadcrumbs("/analytics/performance/");
      expect(result).toEqual([
        { title: "Analytics", section: "analytics" },
        { title: "Performance", section: "performance" },
      ]);
    });

    it("should handle paths with multiple slashes", () => {
      const result = generateBreadcrumbs("//analytics//performance//");
      expect(result).toEqual([
        { title: "Analytics", section: "analytics" },
        { title: "Performance", section: "performance" },
      ]);
    });

    it("should handle unknown segments", () => {
      const result = generateBreadcrumbs("/unknown/segment");
      expect(result).toEqual([
        { title: "Unknown", section: "unknown" },
        { title: "Segment", section: "unknown-segment" },
      ]);
    });

    it("should handle very long IDs", () => {
      const longId = "very-long-id-123456789012345678901234567890";
      const result = generateBreadcrumbs(`/classes/c/${longId}`);
      expect(result[1].title).toBe("very-lon...");
    });
  });
});
