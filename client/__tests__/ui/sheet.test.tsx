import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Sheet", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(
        <Sheet>
          <SheetTrigger>Open Sheet</SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Sheet Title</SheetTitle>
            </SheetHeader>
            Sheet Content
          </SheetContent>
        </Sheet>
      );

      expect(screen.getByText("Open Sheet")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(
        <Sheet>
          <SheetTrigger>Open Sheet</SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Accessible Title</SheetTitle>
            </SheetHeader>
            Accessible Content
          </SheetContent>
        </Sheet>
      );

      const trigger = screen.getByRole("button", { name: "Open Sheet" });
      expect(trigger).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render sheet with trigger and content", () => {
      renderWithMocks(
        <Sheet>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Title</SheetTitle>
            </SheetHeader>
            <div>Content</div>
          </SheetContent>
        </Sheet>
      );

      // Only the trigger should be visible when sheet is closed
      expect(screen.getByText("Trigger")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal sheet
      renderWithMocks(
        <Sheet>
          <SheetTrigger>Minimal</SheetTrigger>
          <SheetContent>Content</SheetContent>
        </Sheet>
      );

      expect(screen.getByText("Minimal")).toBeInTheDocument();
    });
  });
});
