import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Classes from "@/components/classes/Classes";
import { routerMock } from "@/mocks/navigation";
import * as mockSchema from "@/mocks/schema";

// ✨ Import your centralized mock setups
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/navigation";
import "@/mocks/queries";

// ✨ Import the functions you'll need to override or verify
import { deleteClass } from "@/utils/mutations/classes/delete-class";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";

describe("Classes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ——————————————————————————————————————————
  //    BASIC RENDERING
  // ——————————————————————————————————————————
  describe("basic render smoke-test", () => {
    it("renders class cards with data from the mock schema", async () => {
      renderWithMocks(<Classes />);

      expect(await screen.findByText("Algebra I")).toBeInTheDocument();
      expect(screen.getByText("MATH101")).toBeInTheDocument();

      expect(await screen.findByText("General Chemistry")).toBeInTheDocument();
      expect(screen.getByText("CHEM101")).toBeInTheDocument();
    });
  });

  // ——————————————————————————————————————————
  //    USER INTERACTIONS
  // ——————————————————————————————————————————
  describe("User Interactions", () => {
    it("should open the delete confirmation when the delete button is clicked", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Classes />);

      const deleteButton = await screen.findByRole("button", {
        name: /Delete Algebra I/i,
      });
      await user.click(deleteButton);

      expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
      expect(
        screen.getByText(/Are you sure you want to delete this class?/i)
      ).toBeInTheDocument();
    });

    it("should call the delete mutation when deletion is confirmed", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Classes />);

      const deleteButton = await screen.findByRole("button", {
        name: /Delete Algebra I/i,
      });
      await user.click(deleteButton);

      const confirmButton = await screen.findByRole("button", {
        name: "Delete",
      });
      await user.click(confirmButton);

      expect(deleteClass).toHaveBeenCalledWith(mockSchema.classes[0]?.id);

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).toBeNull();
      });
    });
  });

  // ——————————————————————————————————————————
  //    NAVIGATION
  // ——————————————————————————————————————————
  describe("Navigation", () => {
    it("should navigate to the edit page when the edit button is clicked", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Classes />);

      const editButton = await screen.findByRole("button", {
        name: /Edit General Chemistry/i,
      });
      await user.click(editButton);

      expect(routerMock.push).toHaveBeenCalledWith(
        `/create/classes/c/${mockSchema.classes[1]?.id}`
      );
    });
  });

  // ——————————————————————————————————————————
  //    API & EDGE CASES
  // ——————————————————————————————————————————
  describe("API and Edge Cases", () => {
    it("should display skeleton components while loading", async () => {
      // Arrange: Mock the query to be in a perpetual loading state
      vi.mocked(getAllClasses).mockImplementation(() => new Promise(() => {}));

      renderWithMocks(<Classes />);

      // Act: Find all the card elements, which now act as skeleton containers
      const skeletons = await screen.findAllByRole("article"); // The <Card> component has a role of 'article' by default

      // Assert: Check that the correct number of skeletons are rendered
      expect(skeletons.length).toBe(6);

      // Optional: Check for skeleton content within one of the cards
      const firstSkeleton = skeletons[0];
      expect(
        within(firstSkeleton as HTMLElement).getByText(/loading/i, {
          selector: ".sr-only",
        })
      ).toBeInTheDocument(); // Assuming your <Skeleton> has accessible text
    });

    it("should handle and display an API error state", async () => {
      // Arrange: Override the mock to simulate an API failure
      vi.mocked(getAllClasses).mockRejectedValue(new Error("API Error"));

      renderWithMocks(<Classes />);

      // Assert: Check that your component shows the specific error message
      expect(
        await screen.findByText("Failed to load classes.")
      ).toBeInTheDocument();

      // Assert that no data is rendered
      expect(screen.queryByText("Algebra I")).toBeNull();
    });

    it('should display a "No classes found" message when the list is empty', async () => {
      // Arrange: Override the mock to return an empty array
      vi.mocked(getAllClasses).mockResolvedValue([]);

      renderWithMocks(<Classes />);

      // Assert: Check for the specific "No classes found" message
      expect(await screen.findByText("No classes found")).toBeInTheDocument();

      // Assert that no class cards are rendered
      expect(screen.queryByText("Algebra I")).toBeNull();
      expect(screen.queryByText("General Chemistry")).toBeNull();
    });
  });
});
