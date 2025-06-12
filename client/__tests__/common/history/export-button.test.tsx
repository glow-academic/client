import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { ExportButton } from "@/components/common/history/export-button";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the table object for testing
const mockTable = {
  getState: vi.fn(() => ({
    rowSelection: {},
  })),
  getFilteredSelectedRowModel: vi.fn(() => ({
    rows: [],
  })),
  getFilteredRowModel: vi.fn(() => ({
    rows: [
      {
        original: {
          id: "1",
          createdAt: "2024-01-01T10:00:00Z",
          userId: "user1",
          classId: "class1",
          title: "Test Chat 1",
          score: 85,
        },
      },
      {
        original: {
          id: "2",
          createdAt: "2024-01-02T11:00:00Z",
          userId: "user2",
          classId: "class2",
          title: "Test Chat 2",
          score: 92,
        },
      },
    ],
  })),
};

const mockUserOptions = [
  { label: "User 1", value: "user1" },
  { label: "User 2", value: "user2" },
];

const mockClassOptions = [
  { label: "Class 1", value: "class1" },
  { label: "Class 2", value: "class2" },
];

describe("ExportButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      render(
        <ExportButton
          table={mockTable as any}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          viewMode="chats"
        />,
      );

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("should show export button with download icon", () => {
      render(
        <ExportButton
          table={mockTable as any}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          viewMode="chats"
        />,
      );

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("Export");
    });

    it("should show selected count when rows are selected", () => {
      const tableWithSelection = {
        ...mockTable,
        getState: vi.fn(() => ({
          rowSelection: { "1": true, "2": true },
        })),
        getFilteredSelectedRowModel: vi.fn(() => ({
          rows: [{ id: "1" }, { id: "2" }],
        })),
      };

      render(
        <ExportButton
          table={tableWithSelection as any}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          viewMode="chats"
        />,
      );

      expect(screen.getByText("Export (2)")).toBeInTheDocument();
    });
  });

  describe("Export Popover", () => {
    it("should open popover when export button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <ExportButton
          table={mockTable as any}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          viewMode="chats"
        />,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      // Check if popover content appears
      expect(screen.getByText("Export Options")).toBeInTheDocument();
      expect(
        screen.getByText(/Exporting all filtered rows/),
      ).toBeInTheDocument();
    });

    it("should show export information in popover", async () => {
      const user = userEvent.setup();

      render(
        <ExportButton
          table={mockTable as any}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          viewMode="chats"
        />,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      expect(screen.getByText("Export Options")).toBeInTheDocument();
      expect(
        screen.getByText(/Exporting all filtered rows/),
      ).toBeInTheDocument();
    });
  });

  describe("Props Handling", () => {
    it("should handle different viewModes", () => {
      const { rerender } = render(
        <ExportButton
          table={mockTable as any}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          viewMode="chats"
        />,
      );

      expect(screen.getByRole("button")).toBeInTheDocument();

      rerender(
        <ExportButton
          table={mockTable as any}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          viewMode="attempts"
        />,
      );

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("should handle empty options arrays", () => {
      render(
        <ExportButton
          table={mockTable as any}
          profileOptions={[]}
          classOptions={[]}
          viewMode="chats"
        />,
      );

      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for export-button:
 * Path: common/history/export-button.tsx
 *
 * Features detected:
 * - Default export: false
 * - Named exports: columnMap, ExportButton, prepareExport
 * - Has props: false
 * - Props interface: None detected
 * - Client component: true
 * - Uses hooks: useState, userId, profileOptions, user, userOption
 * - Uses router: false
 * - Has API calls: false
 * - Has form handling: false
 * - Uses state: true
 * - Uses effects: false
 * - Uses context: false
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<export-button />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<export-button {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
