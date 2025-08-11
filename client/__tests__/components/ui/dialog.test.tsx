import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Dialog", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Dialog</DialogTitle>
              <DialogDescription>Test Description</DialogDescription>
            </DialogHeader>
            <DialogFooter>Test Footer</DialogFooter>
          </DialogContent>
        </Dialog>,
      );

      expect(screen.getByText("Open Dialog")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Accessible Dialog</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      const trigger = screen.getByRole("button", { name: "Open Dialog" });
      expect(trigger).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render dialog trigger correctly", () => {
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Full Dialog</DialogTitle>
              <DialogDescription>Description</DialogDescription>
            </DialogHeader>
            <div>Content</div>
            <DialogFooter>Footer</DialogFooter>
          </DialogContent>
        </Dialog>,
      );

      // Only the trigger should be visible when dialog is closed
      expect(screen.getByText("Open")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal dialog
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Minimal</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      expect(screen.getByText("Open")).toBeInTheDocument();
    });
  });
});
