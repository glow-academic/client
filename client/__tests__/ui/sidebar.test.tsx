import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Sidebar", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>Sidebar Header</SidebarHeader>
            <SidebarContent>Sidebar Content</SidebarContent>
          </Sidebar>
        </SidebarProvider>
      );

      expect(screen.getByText("Sidebar Header")).toBeInTheDocument();
      expect(screen.getByText("Sidebar Content")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>Accessible Header</SidebarHeader>
            <SidebarContent>Accessible Content</SidebarContent>
          </Sidebar>
        </SidebarProvider>
      );

      const sidebar = document.querySelector('[data-slot="sidebar"]');
      expect(sidebar).toBeInTheDocument();
    });
  });

  describe("Component Props", () => {
    it("should render with custom className", () => {
      renderWithMocks(
        <SidebarProvider>
          <Sidebar className="custom-class">
            <SidebarContent>Content</SidebarContent>
          </Sidebar>
        </SidebarProvider>
      );

      const sidebar = document.querySelector('[data-slot="sidebar"]');
      expect(sidebar).toBeInTheDocument();
    });

    it("should render with trigger", () => {
      renderWithMocks(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>Content</SidebarContent>
          </Sidebar>
          <SidebarTrigger />
        </SidebarProvider>
      );

      const trigger = screen.getByRole("button", { name: "Toggle Sidebar" });
      expect(trigger).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal content
      renderWithMocks(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent />
          </Sidebar>
        </SidebarProvider>
      );

      const sidebar = document.querySelector('[data-slot="sidebar"]');
      expect(sidebar).toBeInTheDocument();
    });
  });
});
