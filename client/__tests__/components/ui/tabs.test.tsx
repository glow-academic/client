import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Tabs", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>,
      );

      expect(screen.getByText("Tab 1")).toBeInTheDocument();
      expect(screen.getByText("Tab 2")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Accessible Tab</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Accessible Content</TabsContent>
        </Tabs>,
      );

      const tab = screen.getByRole("tab", { name: "Accessible Tab" });
      expect(tab).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render tabs with triggers and content", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">First Tab</TabsTrigger>
            <TabsTrigger value="tab2">Second Tab</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">First Content</TabsContent>
          <TabsContent value="tab2">Second Content</TabsContent>
        </Tabs>,
      );

      expect(screen.getByText("First Tab")).toBeInTheDocument();
      expect(screen.getByText("Second Tab")).toBeInTheDocument();
      expect(screen.getByText("First Content")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal tabs
      render(
        <Tabs>
          <TabsList>
            <TabsTrigger value="tab1">Minimal</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>,
      );

      expect(screen.getByText("Minimal")).toBeInTheDocument();
    });
  });
});
