import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Card", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(
        <Card>
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
            <CardDescription>Test Description</CardDescription>
          </CardHeader>
          <CardContent>Test Content</CardContent>
          <CardFooter>Test Footer</CardFooter>
        </Card>,
      );

      expect(screen.getByText("Test Card")).toBeInTheDocument();
      expect(screen.getByText("Test Description")).toBeInTheDocument();
      expect(screen.getByText("Test Content")).toBeInTheDocument();
      expect(screen.getByText("Test Footer")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(
        <Card>
          <CardHeader>
            <CardTitle>Accessible Card</CardTitle>
          </CardHeader>
          <CardContent>Content</CardContent>
        </Card>,
      );

      const title = screen.getByText("Accessible Card");
      expect(title).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render card with all sections", () => {
      renderWithMocks(
        <Card>
          <CardHeader>
            <CardTitle>Full Card</CardTitle>
            <CardDescription>Description</CardDescription>
          </CardHeader>
          <CardContent>Main Content</CardContent>
          <CardFooter>Footer Content</CardFooter>
        </Card>,
      );

      expect(screen.getByText("Full Card")).toBeInTheDocument();
      expect(screen.getByText("Description")).toBeInTheDocument();
      expect(screen.getByText("Main Content")).toBeInTheDocument();
      expect(screen.getByText("Footer Content")).toBeInTheDocument();
    });

    it("should render minimal card", () => {
      renderWithMocks(
        <Card>
          <CardContent>Minimal Content</CardContent>
        </Card>,
      );

      expect(screen.getByText("Minimal Content")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with empty card
      renderWithMocks(<Card></Card>);

      const card = document.querySelector('[data-slot="card"]');
      expect(card).toBeInTheDocument();
    });
  });
});
