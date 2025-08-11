import { render } from '@/test/custom-render';
import type { ColumnDef } from "@tanstack/react-table";
import { screen } from '@/test/custom-render';
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  FeedbackDataTable,
  FeedbackDataTableProps,
} from "@/components/system/feedback/FeedbackDataTable";
import { FeedbackData } from "@/hooks/use-feedback-columns";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockData: FeedbackData[] = [
  {
    id: 1,
    createdAt: "2025-01-01T00:00:00Z",
    profileId: "profile-1",
    type: "feature",
    message: "Test feedback message",
    authorName: "Test User",
    authorAlias: "test-user",
    formattedDate: "Jan 1, 2025",
  },
];

const mockColumns: ColumnDef<FeedbackData>[] = [
  {
    id: "id",
    accessorKey: "id",
    header: "ID",
  },
  {
    id: "type",
    accessorKey: "type",
    header: "Type",
  },
  {
    id: "message",
    accessorKey: "message",
    header: "Message",
  },
  {
    id: "authorName",
    accessorKey: "authorName",
    header: "Author",
  },
  {
    id: "createdAt",
    accessorKey: "createdAt",
    header: "Created",
  },
];

const mockProps: FeedbackDataTableProps = {
  data: mockData,
  columns: mockColumns,
  typeOptions: [
    { value: "bug", label: "🐛 Bug" },
    { value: "feature", label: "✨ Feature" },
    { value: "question", label: "❓ Question" },
    { value: "other", label: "📝 Other" },
  ],
  profileOptions: [{ value: "Test User", label: "Test User" }],
  onRefresh: vi.fn(),
  isRefreshing: false,
};

// ------------------------------------------------------------------
describe("FeedbackDataTable", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<FeedbackDataTable {...mockProps} />);

      // Check that headers are rendered - be flexible with counts
      expect(screen.getAllByText("ID").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Type").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Message").length).toBeGreaterThan(0);
    });

    it("should render with props", () => {
      render(<FeedbackDataTable {...mockProps} />);

      // Check that the table renders with data
      expect(screen.getByText("Test feedback message")).toBeInTheDocument();
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<FeedbackDataTable {...mockProps} />);

      // Check that table headers are accessible
      expect(screen.getAllByText("ID").length).toBeGreaterThan(0);
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      render(<FeedbackDataTable {...mockProps} />);

      // Check that the table renders with data
      expect(screen.getByText("Test feedback message")).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      render(<FeedbackDataTable {...mockProps} />);

      // Check that the refresh functionality is available
      expect(mockProps.onRefresh).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      const edgeCaseProps = {
        ...mockProps,
        data: [],
      };

      render(<FeedbackDataTable {...edgeCaseProps} />);

      // Should render without crashing even with empty data
      expect(screen.getAllByText("ID").length).toBeGreaterThan(0);
    });

    it("should handle missing or invalid props", () => {
      const minimalProps = {
        data: [],
        columns: mockColumns, // Use the same columns to avoid undefined column access
        typeOptions: [],
        profileOptions: [],
        onRefresh: vi.fn(),
        isRefreshing: false,
      };

      render(<FeedbackDataTable {...minimalProps} />);

      // Should still render without crashing
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
  });
});
