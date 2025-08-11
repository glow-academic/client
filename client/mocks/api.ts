import { vi } from "vitest";

// --- Reusable Response Patterns ---
export const mockSuccessResponse = (data: unknown = {}) => ({
  success: true,
  data,
  message: "Operation completed successfully",
  status: "success" as const,
});

export const mockErrorResponse = (
  message = "An error occurred",
  status = 400
) => ({
  success: false,
  error: { message },
  status: "error" as const,
  statusCode: status,
});

export const mockPaginatedResponse = (
  data: unknown[],
  page = 1,
  total = 100
) => ({
  success: true,
  data,
  pagination: {
    page,
    limit: 10,
    total,
    pages: Math.ceil(total / 10),
  },
  status: "success" as const,
});

// --- Individual API Endpoint Mocks ---
// Document-related API mocks
export const deleteDocumentMock = vi
  .fn()
  .mockResolvedValue(mockSuccessResponse());
export const uploadDocumentMock = vi
  .fn()
  .mockResolvedValue(mockSuccessResponse({ id: "doc-123" }));
export const getDocumentMock = vi
  .fn()
  .mockResolvedValue(mockSuccessResponse({ id: "doc-123", name: "test.pdf" }));

// Scenario-related API mocks
export const createScenarioMock = vi
  .fn()
  .mockResolvedValue(mockSuccessResponse({ id: "scenario-123" }));
export const updateScenarioMock = vi
  .fn()
  .mockResolvedValue(mockSuccessResponse());
export const deleteScenarioMock = vi
  .fn()
  .mockResolvedValue(mockSuccessResponse());

// Simulation-related API mocks
export const startSimulationMock = vi
  .fn()
  .mockResolvedValue(mockSuccessResponse({ sessionId: "sim-123" }));
export const endSimulationMock = vi
  .fn()
  .mockResolvedValue(mockSuccessResponse());

// Analytics-related API mocks
export const getAnalyticsMock = vi.fn().mockResolvedValue(
  mockSuccessResponse({
    totalUsers: 100,
    activeSessions: 25,
    completionRate: 0.85,
  })
);

// --- API Module Mocks ---
vi.mock("@/utils/api/documents", () => ({
  deleteDocument: deleteDocumentMock,
  uploadDocument: uploadDocumentMock,
  getDocument: getDocumentMock,
}));

vi.mock("@/utils/api/scenarios", () => ({
  createScenario: createScenarioMock,
  updateScenario: updateScenarioMock,
  deleteScenario: deleteScenarioMock,
}));

vi.mock("@/utils/api/simulations", () => ({
  startSimulation: startSimulationMock,
  endSimulation: endSimulationMock,
}));

vi.mock("@/utils/api/analytics", () => ({
  getAnalytics: getAnalyticsMock,
}));

// --- Fetch API Mock ---
export const mockFetch = vi.fn();
global.fetch = mockFetch;

// --- API Client Mocks ---
vi.mock("@/lib/api-base", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  apiPatch: vi.fn(),
}));

// --- Export a collection for easy access ---
export const apiMocks = {
  // Document mocks
  deleteDocument: deleteDocumentMock,
  uploadDocument: uploadDocumentMock,
  getDocument: getDocumentMock,

  // Scenario mocks
  createScenario: createScenarioMock,
  updateScenario: updateScenarioMock,
  deleteScenario: deleteScenarioMock,

  // Simulation mocks
  startSimulation: startSimulationMock,
  endSimulation: endSimulationMock,

  // Analytics mocks
  getAnalytics: getAnalyticsMock,

  // Global fetch
  fetch: mockFetch,
};

// --- Test Utilities ---
/** Reset all API mocks to their default state */
export const resetAllApiMocks = () => {
  // Reset individual mocks
  Object.values(apiMocks).forEach((mock) => {
    if (typeof mock === "function" && "mockClear" in mock) {
      mock.mockClear();
    }
  });

  // Reset to default responses
  deleteDocumentMock.mockResolvedValue(mockSuccessResponse());
  uploadDocumentMock.mockResolvedValue(mockSuccessResponse({ id: "doc-123" }));
  getDocumentMock.mockResolvedValue(
    mockSuccessResponse({ id: "doc-123", name: "test.pdf" })
  );
  createScenarioMock.mockResolvedValue(
    mockSuccessResponse({ id: "scenario-123" })
  );
  updateScenarioMock.mockResolvedValue(mockSuccessResponse());
  deleteScenarioMock.mockResolvedValue(mockSuccessResponse());
  startSimulationMock.mockResolvedValue(
    mockSuccessResponse({ sessionId: "sim-123" })
  );
  endSimulationMock.mockResolvedValue(mockSuccessResponse());
  getAnalyticsMock.mockResolvedValue(
    mockSuccessResponse({
      totalUsers: 100,
      activeSessions: 25,
      completionRate: 0.85,
    })
  );
};

/** Mock a successful API response */
export const mockApiSuccess = (
  mockFn: ReturnType<typeof vi.fn>,
  data: unknown = {}
) => {
  mockFn.mockResolvedValue(mockSuccessResponse(data));
};

/** Mock a failed API response */
export const mockApiError = (
  mockFn: ReturnType<typeof vi.fn>,
  message = "API Error",
  status = 400
) => {
  mockFn.mockResolvedValue(mockErrorResponse(message, status));
};

/** Mock a network error */
export const mockApiNetworkError = (
  mockFn: ReturnType<typeof vi.fn>,
  error = new Error("Network error")
) => {
  mockFn.mockRejectedValue(error);
};

/** Mock fetch with a specific response */
export const mockFetchResponse = (
  _url: string,
  response: unknown,
  status = 200
) => {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
    text: async () => JSON.stringify(response),
  });
};

/** Mock fetch with an error */
export const mockFetchError = (
  _url: string,
  error = new Error("Fetch failed")
) => {
  mockFetch.mockRejectedValueOnce(error);
};

/** Create a mock API response with custom data */
export const createMockApiResponse = (
  data: unknown,
  success = true,
  message?: string
) => {
  if (success) {
    return mockSuccessResponse(data);
  } else {
    return mockErrorResponse(message || "Operation failed");
  }
};
