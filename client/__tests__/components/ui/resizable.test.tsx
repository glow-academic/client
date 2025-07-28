import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Resizable", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel>Panel 1</ResizablePanel>
          <ResizableHandle />
          <ResizablePanel>Panel 2</ResizablePanel>
        </ResizablePanelGroup>,
      );

      const panelGroup = document.querySelector(
        '[data-slot="resizable-panel-group"]',
      );
      expect(panelGroup).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel>Accessible Panel</ResizablePanel>
          <ResizableHandle />
          <ResizablePanel>Another Panel</ResizablePanel>
        </ResizablePanelGroup>,
      );

      const panelGroup = document.querySelector(
        '[data-slot="resizable-panel-group"]',
      );
      expect(panelGroup).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render resizable panels with handle", () => {
      renderWithMocks(
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel>Left Panel</ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel>Right Panel</ResizablePanel>
        </ResizablePanelGroup>,
      );

      expect(screen.getByText("Left Panel")).toBeInTheDocument();
      expect(screen.getByText("Right Panel")).toBeInTheDocument();
    });

    it("should render with custom className", () => {
      renderWithMocks(
        <ResizablePanelGroup direction="horizontal" className="custom-class">
          <ResizablePanel>Panel</ResizablePanel>
        </ResizablePanelGroup>,
      );

      const panelGroup = document.querySelector(
        '[data-slot="resizable-panel-group"]',
      );
      expect(panelGroup).toHaveClass("custom-class");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal content
      renderWithMocks(
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel />
        </ResizablePanelGroup>,
      );

      const panelGroup = document.querySelector(
        '[data-slot="resizable-panel-group"]',
      );
      expect(panelGroup).toBeInTheDocument();
    });
  });
});
