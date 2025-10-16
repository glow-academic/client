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

// --- API Infrastructure Mocks ---
// V2 API uses React Query hooks that make fetch calls
// We mock fetch and api-base to support all endpoints generically

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
  // Global fetch
  fetch: mockFetch,
};

// --- Test Utilities ---
/** Reset all API mocks to their default state */
export const resetAllApiMocks = () => {
  // Reset fetch mock
  mockFetch.mockClear();
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
