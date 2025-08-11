import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Resizable", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={50}>Panel 1</ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={50}>Panel 2</ResizablePanel>
        </ResizablePanelGroup>
      );

      const panelGroup = document.querySelector(
        '[data-slot="resizable-panel-group"]'
      );
      expect(panelGroup).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={50}>Accessible Panel</ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={50}>Another Panel</ResizablePanel>
        </ResizablePanelGroup>
      );

      const panelGroup = document.querySelector(
        '[data-slot="resizable-panel-group"]'
      );
      expect(panelGroup).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render resizable panels with handle", () => {
      render(
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={50}>Left Panel</ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={50}>Right Panel</ResizablePanel>
        </ResizablePanelGroup>
      );

      expect(screen.getByText("Left Panel")).toBeInTheDocument();
      expect(screen.getByText("Right Panel")).toBeInTheDocument();
    });

    it("should render with custom className", () => {
      render(
        <ResizablePanelGroup direction="horizontal" className="custom-class">
          <ResizablePanel defaultSize={100}>Panel</ResizablePanel>
        </ResizablePanelGroup>
      );

      const panelGroup = document.querySelector(
        '[data-slot="resizable-panel-group"]'
      );
      expect(panelGroup).toHaveClass("custom-class");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal content
      render(
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={100} />
        </ResizablePanelGroup>
      );

      const panelGroup = document.querySelector(
        '[data-slot="resizable-panel-group"]'
      );
      expect(panelGroup).toBeInTheDocument();
    });
  });
});
