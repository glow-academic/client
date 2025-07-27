import { ParametersDataTable } from "@/components/management/parameters/ParametersDataTable";
import { renderWithMocks } from "@/test/renderWithMocks";
import { Parameter } from "@/types";
import { describe, expect, it, vi } from "vitest";

// Mock the toolbar component
vi.mock(
  "@/components/management/parameters/ParametersDataTableToolbar",
  () => ({
    ParametersDataTableToolbar: ({ _table }: { _table: unknown }) => (
      <div data-testid="parameters-toolbar">Toolbar</div>
    ),
  }),
);

// Mock the pagination component
vi.mock("@/components/common/history/DataTablePagination", () => ({
  DataTablePagination: ({ _table }: { _table: unknown }) => (
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

const mockColumns = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "numerical",
    header: "Type",
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
    renderWithMocks(
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
    const { getByTestId } = renderWithMocks(
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
    const { getByTestId } = renderWithMocks(
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
    const { getByText } = renderWithMocks(
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
