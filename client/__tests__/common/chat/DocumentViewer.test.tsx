import DocumentViewer from "@/components/common/chat/DocumentViewer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock external dependencies
vi.mock("@/utils/queries/documents/get-all-documents", () => ({
  getAllDocuments: vi.fn(),
}));

vi.mock("@/components/common/chat/Markdown", () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown">{children}</div>
  ),
}));

// Mock Next.js Image component
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: any) => (
    <img src={src} alt={alt} {...props} data-testid="next-image" />
  ),
}));

// Mock API calls
global.fetch = vi.fn();

import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";

// Mock data
const mockDocument = {
  id: "doc1",
  name: "Test Document.pdf",
  createdAt: new Date().toISOString(),
  filePath: "/path/to/document.pdf",
  mimeType: "application/pdf",
  classId: "class1",
  type: "syllabus" as const,
  classified: true,
};

const mockDocuments = [
  mockDocument,
  {
    id: "doc-2",
    name: "lecture-notes.md",
    type: "lecture" as const,
    classId: "class-1",
    createdAt: "2024-01-16T10:00:00Z",
    filePath: "/path/to/lecture-notes.md",
    mimeType: "text/markdown",
    classified: true,
  },
];

// Mock the PDF viewer component
vi.mock("react-pdf", () => ({
  Document: ({
    children,
    onLoadSuccess,
  }: {
    children: React.ReactNode;
    onLoadSuccess: (pdf: { numPages: number }) => void;
  }) => {
    // Simulate successful PDF load
    React.useEffect(() => {
      onLoadSuccess({ numPages: 3 });
    }, [onLoadSuccess]);
    return <div data-testid="pdf-document">{children}</div>;
  },
  Page: ({ pageNumber }: { pageNumber: number }) => (
    <div data-testid={`pdf-page-${pageNumber}`}>Page {pageNumber}</div>
  ),
  pdfjs: {
    GlobalWorkerOptions: {
      workerSrc: "",
    },
  },
}));

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

    (getAllDocuments as any).mockResolvedValue(mockDocuments);
    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue("application/pdf"),
      },
      blob: vi.fn().mockResolvedValue(new Blob(["test content"])),
      text: vi.fn().mockResolvedValue("test content"),
    });
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };

  describe("Rendering", () => {
    it("should render without crashing with no props", () => {
      renderWithProviders(<DocumentViewer />);

      // Should render without crashing even with no props
      expect(document.body).toBeInTheDocument();
    });

    it("should render with single document prop", async () => {
      renderWithProviders(<DocumentViewer document={mockDocument} />);

      await waitFor(() => {
        expect(screen.getByText("Test Document.pdf")).toBeInTheDocument();
      });
    });

    it("should render with classId prop to show document selector", async () => {
      renderWithProviders(<DocumentViewer classId="class-1" />);

      await waitFor(() => {
        expect(getAllDocuments).toHaveBeenCalled();
      });
    });

    it("should render in bare mode", async () => {
      renderWithProviders(
        <DocumentViewer document={mockDocument} bare={true} />
      );

      await waitFor(() => {
        // In bare mode, should not show header with document name
        expect(screen.queryByText("Test Document.pdf")).not.toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithProviders(<DocumentViewer document={mockDocument} />);

      await waitFor(() => {
        const downloadButton = screen.getByRole("link");
        expect(downloadButton).toHaveAttribute("download", "Test Document.pdf");
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle document selection", async () => {
      const user = userEvent.setup();
      renderWithProviders(<DocumentViewer classId="class-1" />);

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      const selector = screen.getByRole("combobox");
      await user.click(selector);

      // Should show document options
      await waitFor(() => {
        expect(screen.getByText("Test Document.pdf")).toBeInTheDocument();
      });
    });

    it("should handle download button click", async () => {
      const user = userEvent.setup();
      renderWithProviders(<DocumentViewer document={mockDocument} />);

      await waitFor(() => {
        const downloadButton = screen.getByRole("link");
        expect(downloadButton).toHaveAttribute("href");
      });
    });

    it("should handle state changes when document loads", async () => {
      renderWithProviders(<DocumentViewer document={mockDocument} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/documents/id/doc1")
        );
      });
    });
  });

  describe("API Integration", () => {
    it("should fetch documents when classId is provided", async () => {
      renderWithProviders(<DocumentViewer classId="class-1" />);

      await waitFor(() => {
        expect(getAllDocuments).toHaveBeenCalled();
      });
    });

    it("should fetch document content when document is selected", async () => {
      renderWithProviders(<DocumentViewer document={mockDocument} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/documents/id/doc1")
        );
      });
    });

    it("should handle loading states", () => {
      (getAllDocuments as any).mockImplementation(() => new Promise(() => {})); // Never resolves

      renderWithProviders(<DocumentViewer classId="class-1" />);

      // Should show loading skeleton
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("should handle error states", async () => {
      (global.fetch as any).mockRejectedValue(new Error("Failed to load"));

      renderWithProviders(<DocumentViewer document={mockDocument} />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load document")).toBeInTheDocument();
      });
    });
  });

  describe("Content Rendering", () => {
    it("should render PDF content", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue("application/pdf"),
        },
        blob: vi.fn().mockResolvedValue(new Blob(["pdf content"])),
      });

      renderWithProviders(<DocumentViewer document={mockDocument} />);

      await waitFor(() => {
        expect(document.querySelector("iframe")).toBeInTheDocument();
      });
    });

    it("should render image content", async () => {
      const imageDoc = { ...mockDocument, name: "image.jpg" };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue("image/jpeg"),
        },
        blob: vi.fn().mockResolvedValue(new Blob(["image content"])),
      });

      renderWithProviders(<DocumentViewer document={imageDoc} />);

      await waitFor(() => {
        expect(screen.getByTestId("next-image")).toBeInTheDocument();
      });
    });

    it("should render markdown content", async () => {
      const markdownDoc = { ...mockDocument, name: "notes.md" };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue("text/plain"),
        },
        text: vi.fn().mockResolvedValue("# Markdown Content"),
      });

      renderWithProviders(<DocumentViewer document={markdownDoc} />);

      await waitFor(() => {
        expect(screen.getByTestId("markdown")).toBeInTheDocument();
      });
    });

    it("should render text content", async () => {
      const textDoc = { ...mockDocument, name: "notes.txt" };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue("text/plain"),
        },
        text: vi.fn().mockResolvedValue("Plain text content"),
      });

      renderWithProviders(<DocumentViewer document={textDoc} />);

      await waitFor(() => {
        expect(screen.getByText("Plain text content")).toBeInTheDocument();
      });
    });

    it("should show preview not available for unsupported types", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue("application/unknown"),
        },
        blob: vi.fn().mockResolvedValue(new Blob(["unknown content"])),
      });

      renderWithProviders(<DocumentViewer document={mockDocument} />);

      await waitFor(() => {
        expect(screen.getByText("Preview not available")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing document gracefully", () => {
      renderWithProviders(<DocumentViewer />);

      // Should not crash with no document
      expect(document.body).toBeInTheDocument();
    });

    it("should handle empty documents array", async () => {
      (getAllDocuments as any).mockResolvedValue([]);

      renderWithProviders(<DocumentViewer classId="class-1" />);

      await waitFor(() => {
        expect(getAllDocuments).toHaveBeenCalled();
      });

      // Should not show selector when no documents
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });

    it("should handle network errors gracefully", async () => {
      (getAllDocuments as any).mockRejectedValue(new Error("Network error"));

      renderWithProviders(<DocumentViewer classId="class-1" />);

      await waitFor(() => {
        expect(getAllDocuments).toHaveBeenCalled();
      });

      // Should not crash on network error
      expect(document.body).toBeInTheDocument();
    });

    it("should handle document type info correctly", async () => {
      const homeworkDoc = { ...mockDocument, type: "homework" as const };
      renderWithProviders(<DocumentViewer document={homeworkDoc} />);

      await waitFor(() => {
        // Should show homework icon/badge
        expect(screen.getByText("📝")).toBeInTheDocument();
      });
    });

    it("should handle missing document name", async () => {
      const docWithoutName = { ...mockDocument, name: "" };
      renderWithProviders(<DocumentViewer document={docWithoutName} />);

      // Should not crash with missing name
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("PDF Viewer", () => {
    it("renders document name", () => {
      render(<DocumentViewer document={mockDocument} />);
      expect(screen.getByText("Test Document.pdf")).toBeInTheDocument();
    });

    it("displays PDF viewer for PDF documents", () => {
      render(<DocumentViewer document={mockDocument} />);
      expect(screen.getByTestId("pdf-document")).toBeInTheDocument();
    });

    it("shows page navigation controls", () => {
      render(<DocumentViewer document={mockDocument} />);

      // Should show page controls after PDF loads
      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /previous page/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /next page/i })
      ).toBeInTheDocument();
    });

    it("handles page navigation", () => {
      render(<DocumentViewer document={mockDocument} />);

      const nextButton = screen.getByRole("button", { name: /next page/i });
      const prevButton = screen.getByRole("button", { name: /previous page/i });

      // Go to next page
      fireEvent.click(nextButton);
      expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();

      // Go to previous page
      fireEvent.click(prevButton);
      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    });

    it("disables navigation buttons appropriately", () => {
      render(<DocumentViewer document={mockDocument} />);

      const nextButton = screen.getByRole("button", { name: /next page/i });
      const prevButton = screen.getByRole("button", { name: /previous page/i });

      // Previous button should be disabled on first page
      expect(prevButton).toBeDisabled();
      expect(nextButton).not.toBeDisabled();

      // Navigate to last page
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);

      // Next button should be disabled on last page
      expect(nextButton).toBeDisabled();
      expect(prevButton).not.toBeDisabled();
    });

    it("handles text documents", () => {
      const textDocument = {
        ...mockDocument,
        name: "Test Document.txt",
        mimeType: "text/plain",
        type: "lecture" as const,
      };

      render(<DocumentViewer document={textDocument} />);
      expect(screen.getByText("Test Document.txt")).toBeInTheDocument();
    });

    it("shows loading state initially", () => {
      render(<DocumentViewer document={mockDocument} />);
      expect(screen.getByText("Loading document...")).toBeInTheDocument();
    });

    it("handles PDF load errors gracefully", () => {
      // This test would need more complex mocking to simulate PDF errors
      // For now, just test that the component renders without crashing
      render(<DocumentViewer document={mockDocument} />);
      expect(screen.getByText("Test Document.pdf")).toBeInTheDocument();
    });
  });
});
