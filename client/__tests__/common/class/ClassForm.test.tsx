import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import * as tus from "tus-js-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Import the component and mocks
import ClassForm from "@/components/common/class/ClassForm";
import { routerMock } from "@/mocks/navigation";
import * as mockSchema from "@/mocks/schema";
import { renderWithMocks } from "@/test/renderWithMocks";
import { Document } from "@/types";
import { deleteDocument } from "@/utils/api/documents/delete-document";
import { createClass } from "@/utils/mutations/classes/create-class";
import { updateClass } from "@/utils/mutations/classes/update-class";
import { getClass } from "@/utils/queries/classes/get-class";
import { getDocumentsByClass } from "@/utils/queries/documents/get-documents-by-class";

// Mock dependencies
import "@/mocks/queries";
import "@/mocks/mutations";
import "@/mocks/api";
import "@/mocks/navigation";

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

// Mock the global URL.createObjectURL function
const createObjectURL = vi.fn((file) => `blob:${file.name}`);
global.URL.createObjectURL = createObjectURL;

describe("ClassForm", () => {
  const user = userEvent.setup();

  // Reset all mocks after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  // =================================================================
  // == CREATE MODE TESTS
  // =================================================================
  describe("Create Mode", () => {
    beforeEach(() => {
      // Ensure no initial data is fetched for create mode
      vi.mocked(getClass).mockResolvedValue(null);
      vi.mocked(getDocumentsByClass).mockResolvedValue([]);
    });

    it("renders with empty fields and a create button", async () => {
      renderWithMocks(<ClassForm />);

      expect(screen.getByRole("textbox", { name: /Class Name/i })).toHaveValue(
        ""
      );
      expect(screen.getByRole("textbox", { name: /Class Code/i })).toHaveValue(
        ""
      );
      expect(
        await screen.findByRole("button", { name: "Create Class" })
      ).toBeInTheDocument();
      expect(screen.getByText("No documents yet")).toBeInTheDocument();
    });

    it("shows validation errors for required fields on submit", async () => {
      renderWithMocks(<ClassForm />);
      const submitButton = screen.getByRole("button", { name: "Create Class" });

      await user.click(submitButton);

      // Assert error messages appear
      expect(await screen.findByText("Class name is required")).toBeVisible();
      expect(screen.getByText("Class code is required")).toBeVisible();

      // Assert that the create API was NOT called
      expect(createClass).not.toHaveBeenCalled();
    });

    it("successfully creates a class and uploads a new document", async () => {
      // Arrange
      const newClassData = {
        ...mockSchema.classes[0],
        id: "new-class-id",
        name: "New Test Class",
        classCode: "TEST101",
        description: "A great new class.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        year: 2025,
        term: "fall" as const,
        defaultClass: false,
        departmentId: "11111111-1111-1111-1111-111111111111",
        profileIds: [],
      };
      vi.mocked(createClass).mockResolvedValue(newClassData);

      renderWithMocks(<ClassForm />);

      // Act: Fill out the form
      await user.type(
        screen.getByRole("textbox", { name: /Class Name/i }),
        "New Test Class"
      );
      await user.type(
        screen.getByRole("textbox", { name: /Class Code/i }),
        "TEST101"
      );
      await user.type(
        screen.getByRole("textbox", { name: /Description/i }),
        "A great new class."
      );

      // Act: Stage a file for upload
      const file = new File(["syllabus content"], "syllabus.pdf", {
        type: "application/pdf",
      });
      const fileInput = screen.getByTestId("file-input"); // Assuming you add data-testid="file-input" to the hidden input
      await user.upload(fileInput, file);

      // Assert the staged file appears in the UI
      expect(await screen.findByText("syllabus.pdf")).toBeVisible();
      expect(screen.getByText("NEW")).toBeVisible();

      // Act: Submit the form
      const submitButton = screen.getByRole("button", { name: "Create Class" });
      await user.click(submitButton);

      // Assert: API calls and intermediate toast
      await waitFor(() => {
        expect(createClass).toHaveBeenCalledWith(
          expect.objectContaining({ name: "New Test Class" })
        );
        // Check for the first toast
        expect(toast.success).toHaveBeenCalledWith(
          "Class created, now uploading documents..."
        );
      });

      await waitFor(() => {
        // 2. TUS Upload is initiated with the new class ID
        expect(tus.Upload).toHaveBeenCalled();
        const tusCall = vi.mocked(tus.Upload).mock.calls[0];
        const tusMetadata = tusCall?.[1]?.metadata as {
          class: string;
          filename: string;
        };
        expect(tusMetadata?.["class"]).toBe("new-class-id");
        expect(tusMetadata?.["filename"]).toBe("syllabus.pdf");
      });

      // Assert: Final success UI feedback
      await waitFor(() => {
        // Check that the FINAL toast message is also called
        expect(toast.success).toHaveBeenCalledWith(
          "Class created successfully!"
        );
      });

      expect(routerMock.push).toHaveBeenCalledWith("/create/classes");
    });
  });

  // =================================================================
  // == EDIT MODE TESTS
  // =================================================================
  describe("Edit Mode", () => {
    const classId = mockSchema.classes[0]?.id;

    beforeEach(() => {
      // Mock the API calls for fetching existing data
      vi.mocked(getClass).mockResolvedValue({
        ...mockSchema.classes[0]!,
        id: classId!,
        term: "fall" as const,
        defaultClass: false,
      });
      vi.mocked(getDocumentsByClass).mockResolvedValue(
        mockSchema.documents as Document[]
      );
    });

    it("renders with pre-filled form data and existing documents", async () => {
      renderWithMocks(<ClassForm classId={classId!} />);

      // Assert form fields are populated
      expect(
        await screen.findByDisplayValue(mockSchema.classes[0]!.name)
      ).toBeInTheDocument();
      expect(
        screen.getByDisplayValue(mockSchema.classes[0]!.classCode)
      ).toBeInTheDocument();

      // Assert existing documents are displayed
      for (const doc of mockSchema.documents as Document[]) {
        expect(await screen.findByText(doc.name)).toBeInTheDocument();
      }

      // Assert button text is for updating
      expect(
        screen.getByRole("button", { name: "Update Class" })
      ).toBeInTheDocument();
    });

    it("stages a document for deletion and removes it on save", async () => {
      const docToDelete = mockSchema.documents[0]!;
      vi.mocked(updateClass).mockResolvedValue({
        ...mockSchema.classes[0]!,
        name: "Updated Name",
        classCode: "UPDATED101",
        year: 2025,
        term: "fall" as const,
        description: "Updated description",
        defaultClass: false,
      }); // Mock update success

      renderWithMocks(<ClassForm classId={classId!} />);

      await screen.findByText(docToDelete.name);

      // Find the delete button for that specific document
      const deleteButton = screen.getByTestId(`delete-doc-${docToDelete.id}`);

      // Act: Click delete and confirm in the dialog
      await user.click(deleteButton);
      expect(
        await screen.findByRole("dialog", { name: /Remove Document/i })
      ).toBeVisible();
      const confirmRemoveButton = screen.getByRole("button", {
        name: "Remove",
      });
      await user.click(confirmRemoveButton);

      // Assert: The document is gone from the UI immediately
      expect(screen.queryByText(docToDelete.name)).toBeNull();
      expect(toast.info).toHaveBeenCalledWith(
        `'${docToDelete.name}' will be deleted on save.`
      );

      // Act: Save the form
      const submitButton = screen.getByRole("button", { name: "Update Class" });
      await user.click(submitButton);

      // Assert: The delete API was called
      await waitFor(() => {
        expect(deleteDocument).toHaveBeenCalledWith(docToDelete.id);
      });
      expect(toast.success).toHaveBeenCalledWith("Class updated successfully!");
    });
  });

  // =================================================================
  // == LOADING & ERROR STATE TESTS
  // =================================================================
  describe("API Integration and States", () => {
    it("displays skeletons while loading initial data in edit mode", () => {
      // Arrange: Mock a perpetually loading state
      vi.mocked(getClass).mockImplementation(() => new Promise(() => {}));
      renderWithMocks(<ClassForm classId="some-id" />);

      // Assert: Skeletons for form fields are visible
      const skeletons = screen.getAllByTestId("skeleton"); // Add data-testid="skeleton" to your Skeleton components
      expect(skeletons.length).toBeGreaterThan(3);
    });

    it("shows an error toast if creating a class fails", async () => {
      // Arrange: Mock a failure from the create API
      vi.mocked(createClass).mockRejectedValue(new Error("Network Error 500"));
      renderWithMocks(<ClassForm />);

      // Act: Fill form and submit
      await user.type(
        screen.getByRole("textbox", { name: /Class Name/i }),
        "Faulty Class"
      );
      await user.type(
        screen.getByRole("textbox", { name: /Class Code/i }),
        "ERR101"
      );
      await user.type(
        screen.getByRole("textbox", { name: /Description/i }),
        "A great new class."
      );
      await user.click(screen.getByRole("button", { name: "Create Class" }));

      // Assert: An error toast is shown
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to save class: Network Error 500"
        );
      });
    });
  });
});
