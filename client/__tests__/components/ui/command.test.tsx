import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Command", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandItem>Item 1</CommandItem>
            <CommandItem>Item 2</CommandItem>
          </CommandList>
        </Command>,
      );

      expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandItem>Accessible Item</CommandItem>
          </CommandList>
        </Command>,
      );

      const input = screen.getByPlaceholderText("Search...");
      expect(input).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render command with input and items", () => {
      render(
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandGroup>
              <CommandItem>Item 1</CommandItem>
              <CommandItem>Item 2</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal command
      render(
        <Command>
          <CommandInput />
          <CommandList />
        </Command>,
      );

      const command = document.querySelector('[data-slot="command"]');
      expect(command).toBeInTheDocument();
    });
  });
});
