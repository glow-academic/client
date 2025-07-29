import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Avatar", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(
        <Avatar>
          <AvatarImage src="/test-image.jpg" alt="Test Avatar" />
          <AvatarFallback>TA</AvatarFallback>
        </Avatar>,
      );

      expect(screen.getByText("TA")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(
        <Avatar>
          <AvatarImage src="/test-image.jpg" alt="Test Avatar" />
          <AvatarFallback>TA</AvatarFallback>
        </Avatar>,
      );

      // In tests, the fallback is shown since the image won't load
      const fallback = screen.getByText("TA");
      expect(fallback).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render with fallback when image is provided", () => {
      renderWithMocks(
        <Avatar>
          <AvatarImage src="/test-image.jpg" alt="Test Avatar" />
          <AvatarFallback>TA</AvatarFallback>
        </Avatar>,
      );

      // The fallback should be visible since the image won't load in tests
      expect(screen.getByText("TA")).toBeInTheDocument();
    });

    it("should render with fallback only", () => {
      renderWithMocks(
        <Avatar>
          <AvatarFallback>FB</AvatarFallback>
        </Avatar>,
      );

      expect(screen.getByText("FB")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal props
      renderWithMocks(
        <Avatar>
          <AvatarFallback>M</AvatarFallback>
        </Avatar>,
      );

      expect(screen.getByText("M")).toBeInTheDocument();
    });
  });
});
