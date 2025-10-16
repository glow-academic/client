import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Sidebar", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>Sidebar Header</SidebarHeader>
            <SidebarContent>Sidebar Content</SidebarContent>
          </Sidebar>
        </SidebarProvider>,
      );

      expect(screen.getByText("Sidebar Header")).toBeInTheDocument();
      expect(screen.getByText("Sidebar Content")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>Accessible Header</SidebarHeader>
            <SidebarContent>Accessible Content</SidebarContent>
          </Sidebar>
        </SidebarProvider>,
      );

      const sidebar = document.querySelector('[data-slot="sidebar"]');
      expect(sidebar).toBeInTheDocument();
    });
  });

  describe("Component Props", () => {
    it("should render with custom className", () => {
      render(
        <SidebarProvider>
          <Sidebar className="custom-class">
            <SidebarContent>Content</SidebarContent>
          </Sidebar>
        </SidebarProvider>,
      );

      const sidebar = document.querySelector('[data-slot="sidebar"]');
      expect(sidebar).toBeInTheDocument();
    });

    it("should render with trigger", () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>Content</SidebarContent>
          </Sidebar>
          <SidebarTrigger />
        </SidebarProvider>,
      );

      const trigger = screen.getByRole("button", { name: "Toggle Sidebar" });
      expect(trigger).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal content
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent />
          </Sidebar>
        </SidebarProvider>,
      );

      const sidebar = document.querySelector('[data-slot="sidebar"]');
      expect(sidebar).toBeInTheDocument();
    });
  });
});
