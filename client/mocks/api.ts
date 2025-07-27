import { vi } from "vitest";

// Generated automatically by generate-mocks.js
// API mocks for all functions in client/utils/api

// Base mock response data

// Success response
export const mockSuccessResponse = {
  success: true,
  message: "Operation completed successfully",
  status: "success" as const,
};

export const mockErrorResponse = {
  success: false,
  message: "Operation failed",
  status: "error" as const,
};

export const mockDocumentResponse = {
  ...mockSuccessResponse,
  document_id: "doc-123",
  extracted_count: 1,
  documents: [{ id: "doc-123", name: "Test Document" }],
};

const mockScenarioResponse = {
  ...mockSuccessResponse,
  title: "Test Scenario",
  description: "A test scenario for evaluation",
};

const mockReportResponse = {
  ...mockSuccessResponse,
  data: new Response("mock-pdf-data"),
  headers: new Headers({ "content-type": "application/pdf" }),
  text: () => Promise.resolve("mock-text-data"),
  blob: () => Promise.resolve(new Blob(["mock-blob-data"])),
};

// DOCUMENTS API MOCKS
export const deleteDocumentMock = vi.fn(() =>
  Promise.resolve(mockErrorResponse),
);
export const finalizeDocumentUploadMock = vi.fn(() =>
  Promise.resolve(mockDocumentResponse),
);

// SCENARIOS API MOCKS
export const newScenarioMock = vi.fn(() =>
  Promise.resolve(mockScenarioResponse),
);
export const testScenarioMock = vi.fn(() =>
  Promise.resolve(mockReportResponse),
);

vi.mock("@/utils/api/documents/delete-document", () => ({
  deleteDocument: deleteDocumentMock,
}));
vi.mock("@/utils/api/documents/finalize-document-upload", () => ({
  finalizeDocumentUpload: finalizeDocumentUploadMock,
}));
vi.mock("@/utils/api/scenarios/new-scenario", () => ({
  newScenario: newScenarioMock,
}));
vi.mock("@/utils/api/scenarios/test-scenario", () => ({
  testScenario: testScenarioMock,
}));

// Utility functions for testing
export const resetAllApiMocks = () => {
  deleteDocumentMock.mockClear();
  finalizeDocumentUploadMock.mockClear();
  newScenarioMock.mockClear();
  testScenarioMock.mockClear();
};

export const setApiMockResponse = (
  mockFn: ReturnType<typeof vi.fn>,
  response: unknown,
) => {
  mockFn.mockResolvedValue(response);
};

export const setApiMockError = (
  mockFn: ReturnType<typeof vi.fn>,
  error: unknown,
) => {
  mockFn.mockRejectedValue(error);
};

// Export all mocks for easy access
export const apiMocks = {
  deleteDocument: deleteDocumentMock,
  finalizeDocumentUpload: finalizeDocumentUploadMock,
  newScenario: newScenarioMock,
  testScenario: testScenarioMock,
};
