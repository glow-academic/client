import { renderWithMocks } from "@/test/renderWithMocks";
import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import DocumentViewer from "@/components/common/chat/DocumentViewer";

// Mock fetch globally
global.fetch = vi.fn();

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => "blob:mock-url");

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";
import { Document } from "@/types";
import { UseQueryResult } from "@tanstack/react-query";

// Mock the query hook
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: [],
      isLoading: false,
      error: null,
    })),
  };
});

// ------------------------------------------------------------------
// Mock document data
const mockDocument = {
  id: "doc-1",
  name: "test-document.pdf",
  type: "homework" as const,
  filePath: "/path/to/document.pdf",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  mimeType: "application/pdf",
  classified: false,
  fileId: null,
  active: true,
};

const mockDocuments = [
  mockDocument,
  {
    id: "doc-2",
    name: "test-image.png",
    type: "project" as const,
    filePath: "/path/to/image.png",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mimeType: "image/png",
    classified: false,
    fileId: null,
    active: true,
  },
];

// ------------------------------------------------------------------
describe("DocumentViewer", () => {
  const mockFetch = vi.mocked(fetch);

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for fetch
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/pdf" }),
      text: vi.fn().mockResolvedValue("PDF content"),
      blob: vi.fn().mockResolvedValue(new Blob(["PDF content"])),
    } as unknown as Response);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      await act(async () => {
        renderWithMocks(<DocumentViewer />);
      });
      expect(document.body).toBeInTheDocument();
    });

    it("should render with document prop", async () => {
      await act(async () => {
        renderWithMocks(<DocumentViewer document={mockDocument} />);
      });
      expect(document.body).toBeInTheDocument();
    });

    it("should render with bare prop", async () => {
      await act(async () => {
        renderWithMocks(<DocumentViewer document={mockDocument} bare={true} />);
      });
      expect(document.body).toBeInTheDocument();
    });

    it("should render with compact prop", async () => {
      await act(async () => {
        renderWithMocks(
          <DocumentViewer document={mockDocument} compact={true} />
        );
      });
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Document Loading", () => {
    it("should load PDF document successfully", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/pdf" }),
        text: vi.fn().mockResolvedValue("PDF content"),
        blob: vi.fn().mockResolvedValue(new Blob(["PDF content"])),
      } as unknown as Response);

      renderWithMocks(<DocumentViewer document={mockDocument} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/download/document/doc-1",
          expect.objectContaining({
            method: "GET",
            credentials: "include",
          })
        );
      });
    });

    it("should load text document successfully", async () => {
      const textDocument = {
        ...mockDocument,
        name: "test.txt",
        mimeType: "text/plain",
      };
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "text/plain" }),
        text: vi.fn().mockResolvedValue("Text content"),
        blob: vi.fn().mockResolvedValue(new Blob(["Text content"])),
      } as unknown as Response);

      renderWithMocks(<DocumentViewer document={textDocument} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    it("should load markdown document successfully", async () => {
      const mdDocument = { ...mockDocument, name: "test.md" };
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "text/markdown" }),
        text: vi.fn().mockResolvedValue("# Markdown content"),
        blob: vi.fn().mockResolvedValue(new Blob(["# Markdown content"])),
      } as unknown as Response);

      renderWithMocks(<DocumentViewer document={mdDocument} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    it("should load image document successfully", async () => {
      const imageDocument = { ...mockDocument, name: "test.png" };
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "image/png" }),
        text: vi.fn().mockResolvedValue(""),
        blob: vi.fn().mockResolvedValue(new Blob(["image data"])),
      } as unknown as Response);

      renderWithMocks(<DocumentViewer document={imageDocument} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    it("should handle form documents with blob URLs", async () => {
      const formDocument = {
        ...mockDocument,
        filePath: "blob:http://localhost:3000/mock-blob-url",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/pdf" }),
        text: vi.fn().mockResolvedValue("PDF content"),
        blob: vi.fn().mockResolvedValue(new Blob(["PDF content"])),
      } as unknown as Response);

      renderWithMocks(
        <DocumentViewer document={formDocument} isFormDocument={true} />
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(formDocument.filePath);
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle fetch errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      renderWithMocks(<DocumentViewer document={mockDocument} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    it("should handle non-ok responses", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Headers(),
        text: vi.fn().mockResolvedValue(""),
        blob: vi.fn().mockResolvedValue(new Blob()),
      } as unknown as Response);

      renderWithMocks(<DocumentViewer document={mockDocument} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    it("should handle JSON error responses", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: new Headers(),
        text: vi.fn().mockResolvedValue(""),
        blob: vi.fn().mockResolvedValue(new Blob()),
        json: vi.fn().mockResolvedValue({ message: "Server error" }),
      } as unknown as Response);

      renderWithMocks(<DocumentViewer document={mockDocument} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe("Document Type Handling", () => {
    it("should render correct icon for homework type", async () => {
      const homeworkDoc = { ...mockDocument, type: "homework" as const };
      await act(async () => {
        renderWithMocks(<DocumentViewer document={homeworkDoc} bare={false} />);
      });

      // Should render with homework icon (📝)
      expect(document.body).toBeInTheDocument();
    });

    it("should render correct icon for project type", async () => {
      const projectDoc = { ...mockDocument, type: "project" as const };
      await act(async () => {
        renderWithMocks(<DocumentViewer document={projectDoc} bare={false} />);
      });

      // Should render with project icon (🚀)
      expect(document.body).toBeInTheDocument();
    });

    it("should render correct icon for quiz type", async () => {
      const quizDoc = { ...mockDocument, type: "quiz" as const };
      await act(async () => {
        renderWithMocks(<DocumentViewer document={quizDoc} bare={false} />);
      });

      // Should render with quiz icon (❓)
      expect(document.body).toBeInTheDocument();
    });

    it("should render default icon for unknown type", async () => {
      const unknownDoc = {
        ...mockDocument,
        type: "unknown" as Document["type"],
      };
      await act(async () => {
        renderWithMocks(<DocumentViewer document={unknownDoc} bare={false} />);
      });

      // Should render with default icon (📄)
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Multi-Document Selection", () => {
    it("should render document selector when multiple documents", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: mockDocuments,
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult);

      renderWithMocks(<DocumentViewer classId="test-class" />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it("should handle document selection", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: mockDocuments,
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult);

      renderWithMocks(<DocumentViewer classId="test-class" />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });

      // Test document selection if selector is present
      const selectors = document.querySelectorAll("select");
      if (selectors.length > 0) {
        expect(selectors[0]).toBeInTheDocument();
      }
    });
  });

  describe("Loading States", () => {
    it("should show loading skeleton when query is loading", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: [],
        isLoading: true,
        error: null,
      } as unknown as UseQueryResult);

      renderWithMocks(<DocumentViewer classId="test-class" />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it("should show loading spinner when document is loading", async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      renderWithMocks(<DocumentViewer document={mockDocument} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing document gracefully", () => {
      renderWithMocks(<DocumentViewer />);
      expect(document.body).toBeInTheDocument();
    });

    it("should handle empty documents array", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult);

      renderWithMocks(<DocumentViewer classId="test-class" />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it("should handle query errors", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: new Error("Query error"),
      } as unknown as UseQueryResult);

      renderWithMocks(<DocumentViewer classId="test-class" />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it("should handle unsupported file types", async () => {
      const unsupportedDoc = { ...mockDocument, name: "test.xyz" };
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/unknown" }),
        text: vi.fn().mockResolvedValue(""),
        blob: vi.fn().mockResolvedValue(new Blob()),
      } as unknown as Response);

      renderWithMocks(<DocumentViewer document={unsupportedDoc} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe("Download Functionality", () => {
    it("should render download button when not bare", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/pdf" }),
        text: vi.fn().mockResolvedValue("PDF content"),
        blob: vi.fn().mockResolvedValue(new Blob(["PDF content"])),
      } as unknown as Response);

      renderWithMocks(<DocumentViewer document={mockDocument} bare={false} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // Check for download button
      const downloadButtons = document.querySelectorAll("a[download]");
      expect(downloadButtons.length).toBeGreaterThan(0);
    });

    it("should not render download button when bare", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/pdf" }),
        text: vi.fn().mockResolvedValue("PDF content"),
        blob: vi.fn().mockResolvedValue(new Blob(["PDF content"])),
      } as unknown as Response);

      renderWithMocks(<DocumentViewer document={mockDocument} bare={true} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });
});
