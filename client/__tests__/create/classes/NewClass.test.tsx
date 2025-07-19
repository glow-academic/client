import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NewClass from "@/components/classes/NewClass";
import { routerMock } from "@/mocks/navigation";
import * as mockSchema from "@/mocks/schema";
import { renderWithMocks } from "@/test/renderWithMocks";
import {
  finalizeDocumentUpload,
  FinalizeDocumentUploadResponse,
} from "@/utils/api/documents/finalize-document-upload";
import { createClass } from "@/utils/mutations/classes/create-class";

import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/navigation";
import "@/mocks/queries";

// --- Mocks Setup ---
vi.mock("@/components/common/class/ClassForm", () => ({
  default: () => <div data-testid="class-form-mock" />,
}));

describe("NewClass", () => {
  const user = userEvent.setup();

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ——————————————————————————————————————————
  //    Initial Rendering and Mode Selection
  // ——————————————————————————————————————————
  describe("Initial Rendering and Mode Selection", () => {
    it("renders the initial selection cards", () => {
      renderWithMocks(<NewClass />);
      expect(
        screen.getByRole("heading", { name: /Upload from ZIP/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /Create Manually/i })
      ).toBeInTheDocument();
    });

    it("switches to manual creation mode when the manual card is clicked", async () => {
      renderWithMocks(<NewClass />);
      const manualCard = screen
        .getByText(/Create Manually/i)
        .closest("div.cursor-pointer")!;

      await user.click(manualCard);

      // Assert the ClassForm component is now rendered
      expect(screen.getByTestId("class-form-mock")).toBeInTheDocument();
      // Assert the initial selection cards are gone
      expect(
        screen.queryByRole("heading", { name: /Upload from ZIP/i })
      ).not.toBeInTheDocument();
    });
  });

  // ——————————————————————————————————————————
  //    ZIP Upload Flow
  // ——————————————————————————————————————————
  describe("ZIP Upload Flow", () => {
    beforeEach(() => {
      // Mock successful API responses for the happy path
      vi.mocked(createClass).mockResolvedValue({
        ...mockSchema.classes[0],
        id: "new-zip-class-id",
        term: "fall" as "fall" | "spring" | "summer",
        name: "CS101-Fall2025",
        classCode: "CS101",
        year: 2025,
        description: "A great new class.",
        defaultClass: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        departmentId: "11111111-1111-1111-1111-111111111111",
        profileIds: [],
      });
      vi.mocked(finalizeDocumentUpload).mockResolvedValue({
        success: true,
      } as FinalizeDocumentUploadResponse);
    });

    it("handles a successful ZIP upload and navigates to the status page", async () => {
      renderWithMocks(<NewClass />);

      await user.upload(
        screen.getByLabelText(/Upload from ZIP/i, {
          selector: 'input[type="file"]',
        }),
        new File(["zip"], "CS101.zip", { type: "application/zip" })
      );

      // happy-path assertions
      await waitFor(() => {
        expect(createClass).toHaveBeenCalled();
        expect(screen.getByTestId("processing-message")).toHaveTextContent(
          "Processing complete! Redirecting..."
        );
      });

      // the redirect happens after 1 s → just wait for it
      await waitFor(() =>
        expect(routerMock.push).toHaveBeenCalledWith(
          "/create/classes/new/c/new-zip-class-id"
        )
      );
    });
  });

  // ——————————————————————————————————————————
  //    API Error Handling
  // ——————————————————————————————————————————
  describe("API and Error Handling", () => {
    it("handles an error if creating the temporary class fails", async () => {
      // Arrange: Mock a failure from the createClass API
      vi.mocked(createClass).mockRejectedValue(new Error("Database error"));
      renderWithMocks(<NewClass />);

      const zipFile = new File(["zip"], "fail.zip", {
        type: "application/zip",
      });
      const fileInput = screen.getByLabelText(/Upload from ZIP/i, {
        selector: 'input[type="file"]',
      });

      // Act
      await user.upload(fileInput, zipFile);

      // Assert
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to upload ZIP: Database error"
        );
      });

      // The UI should reset, showing the selection cards again
      expect(
        screen.getByRole("heading", { name: /Upload from ZIP/i })
      ).toBeInTheDocument();
    });
  });
});
