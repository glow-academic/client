import { describe, expect, it, vi } from "vitest";

// Import the mock modules to test they work
import "@/mocks/mutations";
import "@/mocks/queries";
import * as mockSchema from "@/mocks/schema";

describe("Generated Mocks Verification", () => {
  describe("Mock Schema", () => {
    it("should have agents mock data", () => {
      expect(mockSchema.agents).toBeDefined();
      expect(Array.isArray(mockSchema.agents)).toBe(true);
      expect(mockSchema.agents.length).toBeGreaterThan(0);

      const agent = mockSchema.agents[0];
      expect(agent).toBeDefined();
      expect(agent).toHaveProperty("id");
      expect(agent).toHaveProperty("name");
      expect(agent).toHaveProperty("description");
      expect(agent?.name).toContain("Agent");
    });

    it("should have scenarios mock data", () => {
      expect(mockSchema.scenarios).toBeDefined();
      expect(Array.isArray(mockSchema.scenarios)).toBe(true);
      expect(mockSchema.scenarios.length).toBeGreaterThan(0);

      const scenario = mockSchema.scenarios[0];
      expect(scenario).toHaveProperty("id");
      expect(scenario).toHaveProperty("name");
      expect(scenario).toHaveProperty("description");
    });

    it("should have rubrics mock data", () => {
      expect(mockSchema.rubrics).toBeDefined();
      expect(Array.isArray(mockSchema.rubrics)).toBe(true);
      expect(mockSchema.rubrics.length).toBeGreaterThan(0);

      const rubric = mockSchema.rubrics[0];
      expect(rubric).toHaveProperty("id");
      expect(rubric).toHaveProperty("name");
      expect(rubric).toHaveProperty("points");
    });

    it("should have proper relationships between entities", () => {
      // Check that simulations reference scenarios and rubrics
      expect(mockSchema.simulations).toBeDefined();
      const simulation = mockSchema.simulations[0];
      expect(simulation).toBeDefined();

      expect(simulation).toHaveProperty("scenarioIds");
      expect(simulation).toHaveProperty("rubricId");
      expect(Array.isArray(simulation?.scenarioIds)).toBe(true);
    });

    it("should have meaningful enum values", () => {
      // Check that enums are being used correctly
      const profile = mockSchema.profiles[0];
      expect(profile).toBeDefined();
      expect(profile?.role).toMatch(/admin|instructional|instructor|ta/);

      const document = mockSchema.documents[0];
      expect(document).toBeDefined();
      expect(document?.type).toMatch(
        /homework|project|quiz|midterm|lab|lecture|syllabus/
      );
    });
  });

  describe("Mock Functions", () => {
    it("should have mocked query functions", async () => {
      // Import a query function to test it's mocked
      const { getAllAgents } = await import(
        "@/utils/queries/agents/get-all-agents"
      );

      expect(vi.isMockFunction(getAllAgents)).toBe(true);

      const result = getAllAgents();
      expect(result).toEqual(mockSchema.agents);
    });

    it("should have mocked mutation functions", async () => {
      // Import a mutation function to test it's mocked
      const { createAgent } = await import(
        "@/utils/mutations/agents/create-agent"
      );

      expect(vi.isMockFunction(createAgent)).toBe(true);
      // The mock function returns the expected data structure
      expect(typeof createAgent).toBe("function");
    });
  });

  describe("Data Quality", () => {
    it("should have meaningful agent names and descriptions", () => {
      const agents = mockSchema.agents;

      agents.forEach((agent, index) => {
        expect(agent.name).toBeTruthy();
        expect(agent.description).toBeTruthy();
        expect(agent.systemPrompt).toBeTruthy();

        // Check for meaningful content
        if (index === 0) {
          expect(agent.name).toContain("Math");
          expect(agent.description).toContain("mathematical");
        }
      });
    });

    it("should have realistic class data", () => {
      const classes = mockSchema.classes;

      classes.forEach((classItem, index) => {
        expect(classItem.name).toBeTruthy();
        expect(classItem.classCode).toBeTruthy();
        expect(classItem.year).toBe(2024);
        expect(classItem.term).toMatch(/fall|spring|summer/);

        if (index === 0) {
          expect(classItem.classCode).toBe("MATH101");
        }
      });
    });

    it("should have proper UUID format for IDs", () => {
      const agent = mockSchema.agents[0];
      expect(agent).toBeDefined();
      expect(agent?.id).toMatch(
        /^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/
      );
    });

    it("should have proper timestamp format", () => {
      const agent = mockSchema.agents[0];
      expect(agent).toBeDefined();
      expect(agent?.createdAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });
});
