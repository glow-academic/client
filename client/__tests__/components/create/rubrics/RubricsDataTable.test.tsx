import { RubricsDataTable } from "@/components/create/rubrics/RubricsDataTable";
import { Rubric } from "@/types";
import type { ColumnDef } from "@tanstack/react-table";
import { render, screen } from '@/test/custom-render';
import { describe, expect, it, vi } from "vitest";

// Mock the RubricsDataTableToolbar component
vi.mock("@/components/create/rubrics/RubricsDataTableToolbar", () => ({
  RubricsDataTableToolbar: () => (
    <div data-testid="rubrics-data-table-toolbar">Toolbar</div>
  ),
}));

// Mock the DataTablePagination component
vi.mock("@/components/common/history/DataTablePagination", () => ({
  DataTablePagination: () => (
    <div data-testid="data-table-pagination">Pagination</div>
  ),
}));

const mockColumns: ColumnDef<Rubric>[] = [
  {
    id: "name",
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => <div>{row.getValue("name")}</div>,
  },
  {
    id: "points",
    accessorKey: "points",
    header: "Total Points",
    cell: ({ row }) => <div>{row.getValue("points")}</div>,
  },
  {
    id: "passPoints",
    accessorKey: "passPoints",
    header: "Pass Points",
    cell: ({ row }) => <div>{row.getValue("passPoints")}</div>,
  },
  {
    id: "passPercentage",
    accessorKey: "passPercentage",
    header: "Pass %",
    cell: ({ row }) => <div>{row.getValue("passPercentage")}</div>,
  },
  {
    id: "active",
    accessorKey: "active",
    header: "Status",
    cell: ({ row }) => <div>{row.getValue("active")}</div>,
  },
  {
    id: "defaultRubric",
    accessorKey: "defaultRubric",
    header: "Type",
    cell: ({ row }) => <div>{row.getValue("defaultRubric")}</div>,
  },
  {
    id: "updatedAt",
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => <div>{row.getValue("updatedAt")}</div>,
  },
];

const mockRubrics: Rubric[] = [
  {
    id: "1",
    name: "Test Rubric 1",
    description: "Test description 1",
    points: 100,
    passPoints: 70,
    defaultRubric: false,
    active: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "2",
    name: "Test Rubric 2",
    description: "Test description 2",
    points: 50,
    passPoints: 35,
    defaultRubric: true,
    active: false,
    createdAt: "2024-01-02T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
  },
];

const mockRenderRubricCard = (rubric: Rubric) => (
  <div key={rubric.id} data-testid={`rubric-card-${rubric.id}`}>
    {rubric.name}
  </div>
);

describe("RubricsDataTable", () => {
  const defaultProps = {
    columns: mockColumns,
    data: mockRubrics,
    passPointsOptions: [
      { value: "0-25", label: "0-25 points" },
      { value: "26-50", label: "26-50 points" },
    ],
    totalPointsOptions: [
      { value: "0-50", label: "0-50 points" },
      { value: "51-100", label: "51-100 points" },
    ],
    passPercentageOptions: [
      { value: "0-50", label: "0-50%" },
      { value: "51-100", label: "51-100%" },
    ],
    renderRubricCard: mockRenderRubricCard,
  };

  it("renders the toolbar", () => {
    render(<RubricsDataTable {...defaultProps} />);
    expect(
      screen.getByTestId("rubrics-data-table-toolbar")
    ).toBeInTheDocument();
  });

  it("renders the pagination", () => {
    render(<RubricsDataTable {...defaultProps} />);
    expect(screen.getByTestId("data-table-pagination")).toBeInTheDocument();
  });

  it("renders rubric cards for each rubric", () => {
    render(<RubricsDataTable {...defaultProps} />);
    expect(screen.getByTestId("rubric-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("rubric-card-2")).toBeInTheDocument();
  });

  it("shows no results message when no data", () => {
    render(<RubricsDataTable {...defaultProps} data={[]} />);
    expect(
      screen.getByText("No rubrics match the current filters.")
    ).toBeInTheDocument();
  });
});
