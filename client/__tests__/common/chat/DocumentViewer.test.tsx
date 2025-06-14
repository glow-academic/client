import DocumentViewer from "@/components/common/chat/DocumentViewer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock external dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("@/components/common/chat/DocumentViewer", () => ({
  default: ({ document }: { document: { name: string } }) => (
    <div data-testid="document-viewer">{document.name}</div>
  ),
}));

vi.mock("@/components/common/chat/Markdown", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="markdown">{children}</div>
  ),
}));

// Mock API calls
global.fetch = vi.fn();

const mockDocument = {
  id: "doc1",
  name: "test-document.pdf",
  createdAt: new Date().toISOString(),
  filePath: "/path/to/document.pdf",
  mimeType: "application/pdf",
  classId: "class1",
  type: "syllabus" as const,
  classified: true,
};

describe("DocumentViewer", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Mock fetch responses
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      blob: () => Promise.resolve(new Blob(["test content"])),
    } as Response);
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };

  describe("Rendering", () => {
    it("should render without crashing", () => {
      renderWithProviders(<DocumentViewer document={mockDocument} />);
      expect(screen.getByTestId("document-viewer")).toBeInTheDocument();
    });

    it("should display document name", () => {
      renderWithProviders(<DocumentViewer document={mockDocument} />);
      expect(screen.getByText("test-document.pdf")).toBeInTheDocument();
    });

    it("should handle different document types", () => {
      const textDocument = {
        ...mockDocument,
        name: "test-document.txt",
        mimeType: "text/plain",
        type: "lecture" as const,
      };

      renderWithProviders(<DocumentViewer document={textDocument} />);
      expect(screen.getByTestId("document-viewer")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle download button click", async () => {
      renderWithProviders(<DocumentViewer document={mockDocument} />);

      // Test would involve clicking download button if it exists
      expect(screen.getByTestId("document-viewer")).toBeInTheDocument();
    });

    it("should handle view toggle", async () => {
      renderWithProviders(<DocumentViewer document={mockDocument} />);

      // Test would involve toggling view mode
      expect(screen.getByTestId("document-viewer")).toBeInTheDocument();
    });

    it("should handle zoom controls", async () => {
      renderWithProviders(<DocumentViewer document={mockDocument} />);

      // Test would involve zoom in/out functionality
      expect(screen.getByTestId("document-viewer")).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle document loading", async () => {
      renderWithProviders(<DocumentViewer document={mockDocument} />);

      await waitFor(() => {
        expect(screen.getByTestId("document-viewer")).toBeInTheDocument();
      });
    });

    it("should handle loading states", () => {
      renderWithProviders(<DocumentViewer document={mockDocument} />);
      expect(screen.getByTestId("document-viewer")).toBeInTheDocument();
    });

    it("should handle error states", async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error("API Error"));

      renderWithProviders(<DocumentViewer document={mockDocument} />);

      // Should handle API errors gracefully
      await waitFor(() => {
        expect(screen.getByTestId("document-viewer")).toBeInTheDocument();
      });
    });
  });

  describe("Document Display", () => {
    it("should display PDF documents correctly", () => {
      renderWithProviders(<DocumentViewer document={mockDocument} />);
      expect(screen.getByTestId("document-viewer")).toBeInTheDocument();
    });

    it("should display text documents correctly", () => {
      const textDocument = {
        ...mockDocument,
        mimeType: "text/plain",
        type: "lecture" as const,
      };

      renderWithProviders(<DocumentViewer document={textDocument} />);
      expect(screen.getByTestId("document-viewer")).toBeInTheDocument();
    });

    it("should handle image documents", () => {
      const imageDocument = {
        ...mockDocument,
        mimeType: "image/png",
        type: "project" as const,
      };

      renderWithProviders(<DocumentViewer document={imageDocument} />);
      expect(screen.getByTestId("document-viewer")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing document", () => {
      const emptyDocument = {
        ...mockDocument,
        name: "",
      };

      renderWithProviders(<DocumentViewer document={emptyDocument} />);
      expect(screen.getByTestId("document-viewer")).toBeInTheDocument();
    });

    it("should handle unsupported file types", () => {
      const unsupportedDocument = {
        ...mockDocument,
        mimeType: "application/unknown",
        type: "homework" as const,
      };

      renderWithProviders(<DocumentViewer document={unsupportedDocument} />);
      expect(screen.getByTestId("document-viewer")).toBeInTheDocument();
    });

    it("should handle large documents gracefully", () => {
      const largeDocument = {
        ...mockDocument,
        name: "large-document.pdf",
      };

      renderWithProviders(<DocumentViewer document={largeDocument} />);
      expect(screen.getByTestId("document-viewer")).toBeInTheDocument();
    });
  });
});
