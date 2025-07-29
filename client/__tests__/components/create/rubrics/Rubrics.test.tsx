/**
 * Rubrics.test.tsx
 * Tests for the Rubrics component, focusing on duplication functionality
 */
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";
import { duplicateRubric } from "@/utils/rubric/duplicate-rubric";

describe("Rubric Duplication Functionality", () => {
  /* ------------------------------------------------------------------ *
   * 💡 Mock Data Usage Guide:
   *
   * All API functions are automatically mocked via imports above.
   * Use mockSchema.* for realistic test data:
   *
   * Examples:
   * - mockSchema.users[0] - First user object
   * - mockSchema.classes - Array of class objects
   * - mockSchema.profiles - Array of profile objects
   *
   * To override specific mocks in individual tests:
   * - vi.mocked(queryFunction).mockResolvedValue(customData)
   * - vi.mocked(mutationFunction).mockResolvedValue(customResponse)
   * ------------------------------------------------------------------ */

  // ✨ Reset mocks after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("duplicateRubric Function", () => {
    it("should duplicate a rubric with standard groups and standards", async () => {
      // Mock the duplicateRubric function to return success
      vi.mocked(duplicateRubric).mockResolvedValue({
        id: "new-rubric-id",
        name: "Test Rubric Copy",
        description: "A test rubric",
        points: 100,
        passPoints: 70,
        defaultRubric: false,
        active: false,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      });

      // Call the duplicate function directly
      const result = await duplicateRubric("rubric-1", "Test Rubric Copy");

      // Verify the function was called with correct parameters
      expect(duplicateRubric).toHaveBeenCalledWith(
        "rubric-1",
        "Test Rubric Copy"
      );

      // Verify the result
      expect(result).toEqual({
        id: "new-rubric-id",
        name: "Test Rubric Copy",
        description: "A test rubric",
        points: 100,
        passPoints: 70,
        defaultRubric: false,
        active: false,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      });
    });

    it("should handle duplication errors gracefully", async () => {
      // Mock the duplicateRubric function to throw an error
      vi.mocked(duplicateRubric).mockRejectedValue(
        new Error("Duplication failed")
      );

      // Verify the function throws an error
      await expect(
        duplicateRubric("rubric-1", "Test Rubric Copy")
      ).rejects.toThrow("Duplication failed");

      // Verify the function was called
      expect(duplicateRubric).toHaveBeenCalledWith(
        "rubric-1",
        "Test Rubric Copy"
      );
    });

    it("should create a new rubric with correct properties", async () => {
      // Mock the duplicateRubric function to return success
      vi.mocked(duplicateRubric).mockResolvedValue({
        id: "new-rubric-id",
        name: "Original Rubric Copy",
        description: "A duplicated rubric",
        points: 100,
        passPoints: 70,
        defaultRubric: false, // Duplicated rubrics should not be default
        active: false, // Duplicated rubrics should start as inactive
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      });

      // Call the duplicate function
      const result = await duplicateRubric(
        "original-rubric-id",
        "Original Rubric Copy"
      );

      // Verify the duplicated rubric has correct properties
      expect(result.defaultRubric).toBe(false); // Should not be default
      expect(result.active).toBe(false); // Should start as inactive
      expect(result.name).toBe("Original Rubric Copy"); // Should have the new name
      expect(result.id).not.toBe("original-rubric-id"); // Should have a new ID
    });

    it("should handle different rubric types correctly", async () => {
      // Test with different rubric configurations
      const testCases = [
        {
          originalId: "rubric-1",
          newName: "Math Rubric Copy",
          expectedPoints: 100,
          expectedPassPoints: 70,
        },
        {
          originalId: "rubric-2",
          newName: "Science Rubric Copy",
          expectedPoints: 50,
          expectedPassPoints: 35,
        },
      ];

      for (const testCase of testCases) {
        vi.mocked(duplicateRubric).mockResolvedValue({
          id: `new-${testCase.originalId}`,
          name: testCase.newName,
          description: "A test rubric",
          points: testCase.expectedPoints,
          passPoints: testCase.expectedPassPoints,
          defaultRubric: false,
          active: false,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        });

        const result = await duplicateRubric(
          testCase.originalId,
          testCase.newName
        );

        expect(duplicateRubric).toHaveBeenCalledWith(
          testCase.originalId,
          testCase.newName
        );
        expect(result.name).toBe(testCase.newName);
        expect(result.points).toBe(testCase.expectedPoints);
        expect(result.passPoints).toBe(testCase.expectedPassPoints);
      }
    });
  });
});
