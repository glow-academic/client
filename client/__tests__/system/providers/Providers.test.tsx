import Providers from "@/components/system/providers/Providers";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the hooks and utilities
vi.mock("@/hooks/use-provider-columns", () => ({
  useProviderColumns: () => ({
    columns: [],
    providerOptions: [
      { value: "provider1", label: "OpenAI" },
      { value: "provider2", label: "Anthropic" },
    ],
    customModelOptions: [
      { value: "Custom", label: "Custom Models" },
      { value: "Standard", label: "Standard Models" },
    ],
    statusOptions: [
      { value: "Active", label: "Active" },
      { value: "Inactive", label: "Inactive" },
    ],
  }),
}));

vi.mock("@/utils/queries/models/get-all-models", () => ({
  getAllModels: vi.fn(),
}));

vi.mock("@/utils/queries/providers/get-all-providers", () => ({
  getAllProviders: vi.fn(),
}));

const mockQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderProviders = () => {
  return render(
    <QueryClientProvider client={mockQueryClient}>
      <Providers />
    </QueryClientProvider>
  );
};

describe("Providers", () => {
  it("renders without crashing", () => {
    renderProviders();
    expect(screen.getByText("No models yet")).toBeInTheDocument();
  });

  it("shows empty state when no models exist", () => {
    renderProviders();
    expect(
      screen.getByText("Create your first model to get started")
    ).toBeInTheDocument();
  });
});
