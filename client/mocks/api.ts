import { vi } from "vitest";

// Generated automatically by generate-mocks.js
// API mocks for all functions in client/utils/api

// Common mock response data
const mockSuccessResponse = {
  success: true,
  message: "Operation completed successfully",
  status: "success" as const,
};

const mockErrorResponse = {
  success: false,
  message: "Operation failed",
  status: "error" as const,
};

const mockProcessingResponse = {
  success: true,
  message: "Operation is being processed",
  status: "processing" as const,
};

// Extended mock responses for specific API types
const mockEvalResponse = {
  ...mockSuccessResponse,
  eval_run_ids: ["eval-run-1", "eval-run-2"],
  total_runs: 2,
};

const mockEvalStatusResponse = {
  ...mockSuccessResponse,
  eval_run_id: "eval-run-1",
  total_chats: 10,
  completed_chats: 5,
  progress_percentage: 50,
  chat_statuses: [
    { chat_id: "chat-1", status: "completed" },
    { chat_id: "chat-2", status: "running" },
  ],
};

const mockSimulationResponse = {
  ...mockSuccessResponse,
  attempt_id: "attempt-123",
  chat_id: "chat-456",
};

const mockDocumentResponse = {
  ...mockSuccessResponse,
  document_id: "doc-123",
  extracted_count: 1,
  documents: [{ id: "doc-123", name: "Test Document" }],
};

const mockAssistantResponse = {
  ...mockSuccessResponse,
  chat_id: "chat-789",
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

const mockStreamResponse = {
  ...mockSuccessResponse,
  response: new Response("mock-stream-data"),
  reader: {
    read: () =>
      Promise.resolve({ done: false, value: new Uint8Array([1, 2, 3]) }),
  },
};

// ASSISTANTS API MOCKS
export const messageAssistantMock = vi.fn(() =>
  Promise.resolve(mockAssistantResponse)
);
export const startAssistantMock = vi.fn(() =>
  Promise.resolve(mockAssistantResponse)
);
export const stopAssistantMock = vi.fn(() =>
  Promise.resolve(mockAssistantResponse)
);

vi.mock("@/utils/api/assistants/message-assistant", () => ({
  messageAssistant: messageAssistantMock,
}));
vi.mock("@/utils/api/assistants/start-assistant", () => ({
  startAssistant: startAssistantMock,
}));
vi.mock("@/utils/api/assistants/stop-assistant", () => ({
  stopAssistant: stopAssistantMock,
}));

// DOCUMENTS API MOCKS
export const deleteDocumentMock = vi.fn(() =>
  Promise.resolve(mockDocumentResponse)
);
export const downloadDocumentMock = vi.fn(() =>
  Promise.resolve(mockReportResponse)
);
export const finalizeDocumentUploadMock = vi.fn(() =>
  Promise.resolve(mockDocumentResponse)
);
export const processCourseMock = vi.fn(() =>
  Promise.resolve(mockSuccessResponse)
);

vi.mock("@/utils/api/documents/delete-document", () => ({
  deleteDocument: deleteDocumentMock,
}));
vi.mock("@/utils/api/documents/download-document", () => ({
  downloadDocument: downloadDocumentMock,
}));
vi.mock("@/utils/api/documents/finalize-document-upload", () => ({
  finalizeDocumentUpload: finalizeDocumentUploadMock,
}));
vi.mock("@/utils/api/documents/process-course", () => ({
  processCourse: processCourseMock,
}));

// EVALS API MOCKS
export const getEvalRunStatusMock = vi.fn(() =>
  Promise.resolve(mockEvalStatusResponse)
);
export const runEvalMock = vi.fn(() => Promise.resolve(mockEvalResponse));
export const startEvalMock = vi.fn(() => Promise.resolve(mockEvalResponse));
export const stopAllEvalRunsMock = vi.fn(() =>
  Promise.resolve(mockEvalResponse)
);

vi.mock("@/utils/api/evals/get-eval-run-status", () => ({
  getEvalRunStatus: getEvalRunStatusMock,
}));
vi.mock("@/utils/api/evals/run-eval", () => ({ runEval: runEvalMock }));
vi.mock("@/utils/api/evals/start-eval", () => ({ startEval: startEvalMock }));
vi.mock("@/utils/api/evals/stop-all-evals", () => ({
  stopAllEvalRuns: stopAllEvalRunsMock,
}));

// PROFILES API MOCKS
export const downloadReportMock = vi.fn(() =>
  Promise.resolve(mockReportResponse)
);
export const downloadReportLegacyMock = vi.fn(() =>
  Promise.resolve(mockReportResponse)
);

vi.mock("@/utils/api/profiles/download-report", () => ({
  downloadReport: downloadReportMock,
}));
vi.mock("@/utils/api/profiles/download-report", () => ({
  downloadReportLegacy: downloadReportLegacyMock,
}));

// SCENARIOS API MOCKS
export const newScenarioMock = vi.fn(() =>
  Promise.resolve(mockScenarioResponse)
);
export const testScenarioMock = vi.fn(() =>
  Promise.resolve(mockStreamResponse)
);

vi.mock("@/utils/api/scenarios/new-scenario", () => ({
  newScenario: newScenarioMock,
}));
vi.mock("@/utils/api/scenarios/test-scenario", () => ({
  testScenario: testScenarioMock,
}));

// SIMULATIONS API MOCKS
export const continueSimulationMock = vi.fn(() =>
  Promise.resolve(mockSimulationResponse)
);
export const createSimulationMessageMock = vi.fn(() =>
  Promise.resolve(mockSimulationResponse)
);
export const startSimulationMock = vi.fn(() =>
  Promise.resolve(mockSimulationResponse)
);
export const stopSimulationMock = vi.fn(() =>
  Promise.resolve(mockSimulationResponse)
);

vi.mock("@/utils/api/simulations/continue-simulation", () => ({
  continueSimulation: continueSimulationMock,
}));
vi.mock("@/utils/api/simulations/create-simulation-message", () => ({
  createSimulationMessage: createSimulationMessageMock,
}));
vi.mock("@/utils/api/simulations/start-simulation", () => ({
  startSimulation: startSimulationMock,
}));
vi.mock("@/utils/api/simulations/stop-simulation", () => ({
  stopSimulation: stopSimulationMock,
}));

// Utility functions for testing
export const resetAllApiMocks = () => {
  messageAssistantMock.mockClear();
  startAssistantMock.mockClear();
  stopAssistantMock.mockClear();
  deleteDocumentMock.mockClear();
  downloadDocumentMock.mockClear();
  finalizeDocumentUploadMock.mockClear();
  processCourseMock.mockClear();
  getEvalRunStatusMock.mockClear();
  runEvalMock.mockClear();
  startEvalMock.mockClear();
  stopAllEvalRunsMock.mockClear();
  downloadReportMock.mockClear();
  downloadReportLegacyMock.mockClear();
  newScenarioMock.mockClear();
  testScenarioMock.mockClear();
  continueSimulationMock.mockClear();
  createSimulationMessageMock.mockClear();
  startSimulationMock.mockClear();
  stopSimulationMock.mockClear();
};

export const setApiMockResponse = (mockFn: any, response: any) => {
  mockFn.mockResolvedValue(response);
};

export const setApiMockError = (mockFn: any, error: any) => {
  mockFn.mockRejectedValue(error);
};

// Export all mocks for easy access
export const apiMocks = {
  messageAssistant: messageAssistantMock,
  startAssistant: startAssistantMock,
  stopAssistant: stopAssistantMock,
  deleteDocument: deleteDocumentMock,
  downloadDocument: downloadDocumentMock,
  finalizeDocumentUpload: finalizeDocumentUploadMock,
  processCourse: processCourseMock,
  getEvalRunStatus: getEvalRunStatusMock,
  runEval: runEvalMock,
  startEval: startEvalMock,
  stopAllEvalRuns: stopAllEvalRunsMock,
  downloadReport: downloadReportMock,
  downloadReportLegacy: downloadReportLegacyMock,
  newScenario: newScenarioMock,
  testScenario: testScenarioMock,
  continueSimulation: continueSimulationMock,
  createSimulationMessage: createSimulationMessageMock,
  startSimulation: startSimulationMock,
  stopSimulation: stopSimulationMock,
};
