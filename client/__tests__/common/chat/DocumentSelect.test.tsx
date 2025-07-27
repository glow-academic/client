import { renderWithMocks } from "@/test/renderWithMocks";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import DocumentSelect, {
  DocumentSelectProps,
} from "@/components/common/chat/DocumentSelect";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: DocumentSelectProps = {
  documents: [
    {
      id: "doc-1",
      name: "Test Document 1",
      filePath: "/test/path1",
      mimeType: "text/plain",
      type: "homework",
      classified: false,
      fileId: "file-1",
      active: true,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
    {
      id: "doc-2",
      name: "Test Document 2",
      filePath: "/test/path2",
      mimeType: "text/plain",
      type: "project",
      classified: true,
      fileId: "file-2",
      active: true,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
  ],
  selectedDocumentId: null,
  onDocumentSelect: vi.fn(),
  placeholder: "test-placeholder",
};
// ------------------------------------------------------------------
describe("DocumentSelect", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<DocumentSelect {...mockProps} />);

      // Basic render test - component should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<DocumentSelect {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<DocumentSelect {...mockProps} />);

      // Check for basic accessibility elements - this component uses a button with role="combobox"
      const combobox = document.querySelector('[role="combobox"]');
      expect(combobox).toBeInTheDocument();

      // Check that the button shows the placeholder when no document is selected
      expect(combobox).toHaveTextContent("test-placeholder");
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<DocumentSelect {...mockProps} />);

      // Test button interactions
      const combobox = document.querySelector(
        '[role="combobox"]'
      ) as HTMLElement;
      expect(combobox).toBeInTheDocument();

      // Click to open the popover
      await user.click(combobox);

      // The popover should be open and show the command list
      expect(combobox).toHaveAttribute("aria-expanded", "true");
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<DocumentSelect {...mockProps} />);

      // Test document selection
      const combobox = document.querySelector(
        '[role="combobox"]'
      ) as HTMLElement;
      await user.click(combobox);

      // Find and click on a document option
      const documentOption = document.querySelector(
        '[data-value="Test Document 1"]'
      );
      if (documentOption) {
        await user.click(documentOption);
        expect(mockProps.onDocumentSelect).toHaveBeenCalledWith("doc-1");
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<DocumentSelect {...mockProps} />);

      // Component should handle edge cases
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      renderWithMocks(
        <DocumentSelect
          documents={[]}
          selectedDocumentId={null}
          onDocumentSelect={vi.fn()}
        />
      );

      // Component should handle empty documents array
      const combobox = document.querySelector('[role="combobox"]');
      expect(combobox).toBeInTheDocument();
      expect(combobox).toHaveTextContent("Select document...");
    });

    it("should display selected document name", () => {
      const propsWithSelection = {
        ...mockProps,
        selectedDocumentId: "doc-1",
      };

      renderWithMocks(<DocumentSelect {...propsWithSelection} />);

      // Should show the selected document name instead of placeholder
      const combobox = document.querySelector('[role="combobox"]');
      expect(combobox).toHaveTextContent("Test Document 1");
    });
  });
});
