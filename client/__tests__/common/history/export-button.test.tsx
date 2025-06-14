import { ExportButton } from "@/components/common/history/export-button";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock icons
vi.mock("lucide-react", () => ({
  Download: () => <div data-testid="download-icon" />,
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
          simulationTitle: "Test Simulation",
          averageScore: 85,
          classId: "class1",
        },
        getValue: vi.fn((key: string) => {
          const data = {
            id: "1",
            createdAt: "2024-01-01T10:00:00Z",
            userId: "user1",
            simulationTitle: "Test Simulation",
            averageScore: 85,
            classId: "class1",
          };
          return data[key as keyof typeof data];
        }),
      },
      {
        original: {
          id: "2",
          createdAt: "2024-01-02T11:00:00Z",
          userId: "user2",
          simulationTitle: "Another Simulation",
          averageScore: 78,
          classId: "class2",
        },
        getValue: vi.fn((key: string) => {
          const data = {
            id: "2",
            createdAt: "2024-01-02T11:00:00Z",
            userId: "user2",
            simulationTitle: "Another Simulation",
            averageScore: 78,
            classId: "class2",
          };
          return data[key as keyof typeof data];
        }),
      },
    ],
  })),
  getVisibleLeafColumns: vi.fn(() => [
    { id: "createdAt", columnDef: { header: "Date" } },
    { id: "simulationTitle", columnDef: { header: "Simulation" } },
    { id: "averageScore", columnDef: { header: "Score" } },
  ]),
};

// Mock DOM methods
const mockLink = {
  href: "",
  download: "",
  click: vi.fn(),
  style: { visibility: "" },
  setAttribute: vi.fn(),
};

const mockURL = {
  createObjectURL: vi.fn(() => "blob:mock-url"),
  revokeObjectURL: vi.fn(),
};

// Setup DOM mocks
beforeEach(() => {
  vi.clearAllMocks();

  // Mock document.createElement
  vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
    if (tagName === "a") {
      return mockLink as any;
    }
    return document.createElement(tagName);
  });

  // Mock document.body.appendChild and removeChild
  vi.spyOn(document.body, "appendChild").mockImplementation(
    () => mockLink as any
  );
  vi.spyOn(document.body, "removeChild").mockImplementation(
    () => mockLink as any
  );

  // Mock URL methods
  global.URL = mockURL as any;

  // Mock Blob constructor
  global.Blob = vi.fn().mockImplementation((content, options) => ({
    content,
    options,
    size: content ? content[0].length : 0,
    type: options?.type || "",
  })) as any;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const mockUserOptions = [
  { label: "User 1", value: "user1" },
  { label: "User 2", value: "user2" },
];

const mockClassOptions = [
  { label: "Class 1", value: "class1" },
  { label: "Class 2", value: "class2" },
];

describe("ExportButton", () => {
  describe("Rendering", () => {
    it("should render without crashing", () => {
      render(
        <ExportButton
          table={mockTable as any}
          profileOptions={[]}
          classOptions={[]}
        />
      );

      expect(screen.getByText("Export")).toBeInTheDocument();
    });

    it("should render export button with correct text", () => {
      render(
        <ExportButton
          table={mockTable as any}
          profileOptions={[]}
          classOptions={[]}
        />
      );

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("Export");
    });

    it("should show download icon", () => {
      render(
        <ExportButton
          table={mockTable as any}
          profileOptions={[]}
          classOptions={[]}
        />
      );

      // The icon should be rendered (mocked as div with data-testid)
      expect(screen.getByTestId("download-icon")).toBeInTheDocument();
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
        />
      );

      expect(screen.getByText("Export (2)")).toBeInTheDocument();
    });

    it("should show export text without count when no rows selected", () => {
      render(
        <ExportButton
          table={mockTable as any}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
        />
      );

      expect(screen.getByText("Export")).toBeInTheDocument();
      expect(screen.queryByText(/Export \(\d+\)/)).not.toBeInTheDocument();
    });
  });

  describe("Export Functionality", () => {
    it("should handle CSV export", async () => {
      const user = userEvent.setup();

      render(
        <ExportButton
          table={mockTable as any}
          profileOptions={[]}
          classOptions={[]}
        />
      );

      const exportButton = screen.getByRole("button");
      await user.click(exportButton);

      expect(mockURL.createObjectURL).toHaveBeenCalled();
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockURL.revokeObjectURL).toHaveBeenCalled();
    });

    it("should handle export with empty data", () => {
      const emptyTable = {
        ...mockTable,
        getFilteredRowModel: vi.fn(() => ({
          rows: [],
        })),
      };

      render(
        <ExportButton
          table={emptyTable as any}
          profileOptions={[]}
          classOptions={[]}
        />
      );

      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("Props Handling", () => {
    it("should handle empty options arrays", () => {
      render(
        <ExportButton
          table={mockTable as any}
          profileOptions={[]}
          classOptions={[]}
        />
      );

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("should handle different table states", () => {
      const differentTable = {
        ...mockTable,
        getState: vi.fn(() => ({
          rowSelection: { "1": true },
        })),
      };

      render(
        <ExportButton
          table={differentTable as any}
          profileOptions={[]}
          classOptions={[]}
        />
      );

      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper button attributes", () => {
      render(
        <ExportButton
          table={mockTable as any}
          profileOptions={[]}
          classOptions={[]}
        />
      );

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("type", "button");
    });

    it("should be keyboard accessible", async () => {
      const user = userEvent.setup();

      render(
        <ExportButton
          table={mockTable as any}
          profileOptions={[]}
          classOptions={[]}
        />
      );

      const button = screen.getByRole("button");
      await user.tab();
      expect(button).toHaveFocus();
    });
  });

  describe("Edge Cases", () => {
    it("should handle malformed data gracefully", () => {
      const malformedTable = {
        ...mockTable,
        getFilteredRowModel: vi.fn(() => ({
          rows: [
            {
              original: {
                id: null,
                createdAt: undefined,
                simulationTitle: "",
              },
            },
          ],
        })),
      };

      render(
        <ExportButton
          table={malformedTable as any}
          profileOptions={[]}
          classOptions={[]}
        />
      );

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("should handle very large datasets", () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        original: {
          id: i.toString(),
          createdAt: "2024-01-01T10:00:00Z",
          simulationTitle: `Simulation ${i}`,
          averageScore: Math.floor(Math.random() * 100),
        },
      }));

      const largeDataTable = {
        ...mockTable,
        getFilteredRowModel: vi.fn(() => ({
          rows: largeData,
        })),
      };

      render(
        <ExportButton
          table={largeDataTable as any}
          profileOptions={[]}
          classOptions={[]}
        />
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
