import { ParametersDataTable } from "@/components/management/parameters/ParametersDataTable";
import { render } from "@/test/custom-render";
import { Parameter } from "@/types";
import type { ColumnDef } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";

// Mock the toolbar component
vi.mock(
  "@/components/management/parameters/ParametersDataTableToolbar",
  () => ({
    ParametersDataTableToolbar: () => (
      <div data-testid="parameters-toolbar">Toolbar</div>
    ),
  }),
);

// Mock the pagination component
vi.mock("@/components/common/history/DataTablePagination", () => ({
  DataTablePagination: () => (
    <div data-testid="parameters-pagination">Pagination</div>
  ),
}));

const mockParameters: Parameter[] = [
  {
    id: "param-1",
    name: "Test Parameter 1",
    description: "Test description 1",
    numerical: true,
    active: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "param-2",
    name: "Test Parameter 2",
    description: "Test description 2",
    numerical: false,
    active: false,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

const mockColumns: ColumnDef<Parameter>[] = [
  {
    id: "name",
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => <div>{row.getValue("name")}</div>,
  },
  {
    id: "numerical",
    accessorKey: "numerical",
    header: "Type",
    cell: ({ row }) => <div>{row.getValue("numerical")}</div>,
  },
  {
    id: "itemCount",
    accessorKey: "itemCount",
    header: "Items",
    cell: ({ row }) => <div>{row.getValue("itemCount")}</div>,
  },
  {
    id: "active",
    accessorKey: "active",
    header: "Status",
    cell: ({ row }) => <div>{row.getValue("active")}</div>,
  },
  {
    id: "scenarioIds",
    accessorKey: "scenarioIds",
    header: "Scenarios",
    cell: ({ row }) => <div>{row.getValue("scenarioIds")}</div>,
  },
  {
    id: "updatedAt",
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => <div>{row.getValue("updatedAt")}</div>,
  },
];

const mockOptions = {
  typeOptions: [
    { value: "numerical", label: "Numerical" },
    { value: "text", label: "Text" },
  ],
  itemCountOptions: [
    { value: "0", label: "0 items" },
    { value: "1-3", label: "1-3 items" },
  ],
  statusOptions: [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ],
  scenarioOptions: [
    { value: "scenario-1", label: "Scenario 1" },
    { value: "scenario-2", label: "Scenario 2" },
  ],
};

const mockRenderParameterCard = (parameter: Parameter) => (
  <div key={parameter.id} data-testid={`parameter-card-${parameter.id}`}>
    {parameter.name}
  </div>
);

describe("ParametersDataTable", () => {
  it("renders without crashing", () => {
    render(
      <ParametersDataTable
        columns={mockColumns}
        data={mockParameters}
        typeOptions={mockOptions.typeOptions}
        itemCountOptions={mockOptions.itemCountOptions}
        statusOptions={mockOptions.statusOptions}
        scenarioOptions={mockOptions.scenarioOptions}
        renderParameterCard={mockRenderParameterCard}
      />,
    );
  });

  it("renders toolbar and pagination components", () => {
    const { getByTestId } = render(
      <ParametersDataTable
        columns={mockColumns}
        data={mockParameters}
        typeOptions={mockOptions.typeOptions}
        itemCountOptions={mockOptions.itemCountOptions}
        statusOptions={mockOptions.statusOptions}
        scenarioOptions={mockOptions.scenarioOptions}
        renderParameterCard={mockRenderParameterCard}
      />,
    );

    expect(getByTestId("parameters-toolbar")).toBeInTheDocument();
    expect(getByTestId("parameters-pagination")).toBeInTheDocument();
  });

  it("renders parameter cards for each parameter", () => {
    const { getByTestId } = render(
      <ParametersDataTable
        columns={mockColumns}
        data={mockParameters}
        typeOptions={mockOptions.typeOptions}
        itemCountOptions={mockOptions.itemCountOptions}
        statusOptions={mockOptions.statusOptions}
        scenarioOptions={mockOptions.scenarioOptions}
        renderParameterCard={mockRenderParameterCard}
      />,
    );

    expect(getByTestId("parameter-card-param-1")).toBeInTheDocument();
    expect(getByTestId("parameter-card-param-2")).toBeInTheDocument();
  });

  it("shows empty state when no parameters match filters", () => {
    const { getByText } = render(
      <ParametersDataTable
        columns={mockColumns}
        data={[]}
        typeOptions={mockOptions.typeOptions}
        itemCountOptions={mockOptions.itemCountOptions}
        statusOptions={mockOptions.statusOptions}
        scenarioOptions={mockOptions.scenarioOptions}
        renderParameterCard={mockRenderParameterCard}
      />,
    );

    expect(
      getByText("No parameters match the current filters."),
    ).toBeInTheDocument();
  });
});
