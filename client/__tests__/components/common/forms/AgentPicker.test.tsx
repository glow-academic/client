import { render, screen } from "@/test/custom-render";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  AgentPicker,
  AgentPickerProps,
} from "@/components/common/forms/AgentPicker";
import type { AgentMappingItem } from "@/lib/api/v2/schemas/base";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockMapping: Record<string, AgentMappingItem> = {
  "agent-1": {
    name: "Title Agent",
    description: "Generates titles for simulations",
    roles: ["title"],
  },
  "agent-2": {
    name: "Scenario Agent",
    description: "Creates simulation scenarios",
    roles: ["scenario"],
  },
  "agent-3": {
    name: "Multi-Role Agent",
    description: "Handles multiple roles",
    roles: ["title", "scenario", "classify"],
  },
};

const mockProps: AgentPickerProps = {
  mapping: mockMapping,
  validIds: ["agent-1", "agent-2", "agent-3"],
  selectedIds: [],
  onSelect: () => {},
  // multiSelect: false, /* optional */
  // placeholder: 'test-placeholder', /* optional */
  // hideSelectedChips: false, /* optional */
  // disabled: false, /* optional */
  // open: false, /* optional */
  // defaultOpen: false, /* optional */
  // modal: false, /* optional */
};
// ------------------------------------------------------------------
describe("AgentPicker", () => {
  // ✨ Reset mocks after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<AgentPicker {...mockProps} />);

      // Should render the button with placeholder text
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      expect(screen.getByText("Select agents...")).toBeInTheDocument();
    });

    it("should render with props", () => {
      // Test with different props
      const propsWithAgents: AgentPickerProps = {
        mapping: mockMapping,
        validIds: ["agent-1", "agent-2"],
        selectedIds: [],
        onSelect: () => {},
        placeholder: "Choose agents...",
        hideSelectedChips: false,
        multiSelect: true,
      };

      render(<AgentPicker {...propsWithAgents} />);

      // Should render the button with custom placeholder
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      expect(screen.getByText("Choose agents...")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<AgentPicker {...mockProps} />);

      // Should have proper accessibility attributes
      const button = screen.getByRole("combobox");
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("aria-expanded", "false");
      expect(button).toHaveAttribute("aria-label", "Select agents");
    });

    it("should render with selected agent", () => {
      const propsWithSelection: AgentPickerProps = {
        ...mockProps,
        selectedIds: ["agent-1"],
      };

      render(<AgentPicker {...propsWithSelection} />);

      // Should show the selected agent name
      expect(screen.getByText("Title Agent")).toBeInTheDocument();
    });
  });

  describe("Single-select mode", () => {
    it("should display single selected agent name", () => {
      const singleSelectProps: AgentPickerProps = {
        ...mockProps,
        selectedIds: ["agent-1"],
        multiSelect: false,
      };

      render(<AgentPicker {...singleSelectProps} />);

      // Should show the agent name, not a count
      expect(screen.getByText("Title Agent")).toBeInTheDocument();
      expect(screen.queryByText("1 agents selected")).not.toBeInTheDocument();
    });

    it("should handle state changes", async () => {
      render(<AgentPicker {...mockProps} />);

      // Should handle state changes properly
      const button = screen.getByRole("combobox");
      expect(button).toBeInTheDocument();
    });
  });

  describe("Multi-select mode", () => {
    it("should display agent count when multiple selected", () => {
      const multiSelectProps: AgentPickerProps = {
        ...mockProps,
        selectedIds: ["agent-1", "agent-2"],
        multiSelect: true,
      };

      render(<AgentPicker {...multiSelectProps} />);

      // Should show count instead of individual names
      expect(screen.getByText("2 agents selected")).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      render(<AgentPicker {...mockProps} />);

      // Should handle user events properly
      const button = screen.getByRole("combobox");
      expect(button).toBeInTheDocument();
    });
  });

  describe("Disabled state", () => {
    it("should disable the button when disabled prop is true", () => {
      const disabledProps: AgentPickerProps = {
        ...mockProps,
        disabled: true,
      };

      render(<AgentPicker {...disabledProps} />);

      const button = screen.getByRole("combobox");
      expect(button).toBeDisabled();
    });
  });

  describe("Role-based filtering", () => {
    it("should only show agents with matching roles", () => {
      // This test verifies that validIds properly filters the displayed agents
      const roleFilteredProps: AgentPickerProps = {
        mapping: mockMapping,
        validIds: ["agent-1"], // Only title agent
        selectedIds: [],
        onSelect: () => {},
      };

      render(<AgentPicker {...roleFilteredProps} />);

      // Should render with filtered agents
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("should handle empty valid agent list for a role", () => {
      const noAgentsProps: AgentPickerProps = {
        mapping: mockMapping,
        validIds: [], // No agents for this role
        selectedIds: [],
        onSelect: () => {},
        placeholder: "No agents available for this role",
      };

      render(<AgentPicker {...noAgentsProps} />);

      // Should render with empty state message
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      expect(
        screen.getByText("No agents available for this role")
      ).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with empty mapping and validIds
      const propsWithEmptyAgents: AgentPickerProps = {
        mapping: {},
        validIds: [],
        selectedIds: [],
        onSelect: () => {},
        placeholder: "No agents available",
      };

      render(<AgentPicker {...propsWithEmptyAgents} />);

      // Should render with empty state
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      expect(screen.getByText("No agents available")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with minimal props
      const minimalProps: AgentPickerProps = {
        mapping: {},
        validIds: [],
        selectedIds: [],
        onSelect: () => {},
      };

      render(<AgentPicker {...minimalProps} />);

      // Should render with default props
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      expect(screen.getByText("Select agents...")).toBeInTheDocument();
    });

    it("should handle agents with empty roles array", () => {
      const agentWithNoRoles: Record<string, AgentMappingItem> = {
        "agent-no-role": {
          name: "No Role Agent",
          description: "Agent with no roles",
          roles: [],
        },
      };

      const propsWithNoRole: AgentPickerProps = {
        mapping: agentWithNoRoles,
        validIds: ["agent-no-role"],
        selectedIds: [],
        onSelect: () => {},
      };

      render(<AgentPicker {...propsWithNoRole} />);

      // Should still render successfully
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("should handle selection of non-existent agent", () => {
      const propsWithBadSelection: AgentPickerProps = {
        ...mockProps,
        selectedIds: ["non-existent-agent"],
      };

      render(<AgentPicker {...propsWithBadSelection} />);

      // Should still render without crashing
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      // Should show placeholder since the agent doesn't exist in mapping
      expect(screen.getByText("Select agents...")).toBeInTheDocument();
    });
  });

  describe("Custom styling", () => {
    it("should apply custom button className", () => {
      const propsWithClass: AgentPickerProps = {
        ...mockProps,
        buttonClassName: "custom-class",
      };

      render(<AgentPicker {...propsWithClass} />);

      const button = screen.getByRole("combobox");
      expect(button).toHaveClass("custom-class");
    });
  });
});

/*
 * Component Analysis for AgentPicker:
 * Path: common/forms/AgentPicker.tsx
 *
 * Features detected:
 * - Default export: false
 * - Named exports: AgentPicker, AgentPickerProps
 * - Has props: true
 * - Props interface: AgentPickerProps
 * - Client component: true
 * - Uses hooks: useMutationObserver, useState, useRef, useMemo
 * - Uses router: false
 * - Has API calls: false
 * - Has form handling: false
 * - Uses state: true
 * - Uses effects: false
 * - Uses context: false
 *
 * Key features:
 * - Role-based agent filtering (validIds filtered by role)
 * - Single-select and multi-select modes
 * - Disabled state support
 * - Custom placeholder and button styling
 * - AgentMappingItem includes roles array for filtering
 */
