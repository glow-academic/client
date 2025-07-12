import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import ClassStatus, {
  ClassStatusProps,
} from "@/components/create/classes/ClassStatus";
import * as mockSchema from "@/mocks/schema";
import { renderWithMocks } from "@/test/renderWithMocks";
import { Document, Event, Schedule, Topic } from "@/types";
import { getClass } from "@/utils/queries/classes/get-class";
import { getDocumentsByClass } from "@/utils/queries/documents/get-documents-by-class";
import { getEventsBySchedules } from "@/utils/queries/events/get-events-by-schedules";
import { getSchedulesByClass } from "@/utils/queries/schedules/get-schedules-by-class";
import { getTopicsByClass } from "@/utils/queries/topics/get-topics-by-class";

const mockProps: ClassStatusProps = {
  classId: mockSchema.classes[0]!.id,
};

describe("ClassStatus", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ——————————————————————————————————————————
  //    API & Component States
  // ——————————————————————————————————————————
  describe("API Integration and Component States", () => {
    it("should display skeletons while loading", () => {
      // Arrange: Mock a query to be in a perpetual loading state
      vi.mocked(getClass).mockImplementation(() => new Promise(() => {}));
      renderWithMocks(<ClassStatus {...mockProps} />);

      // Assert: Check for the presence of multiple skeleton components
      const skeletons = screen.getAllByTestId("skeleton"); // Skeletons have a role of 'status'
      expect(skeletons.length).toBeGreaterThan(2);
      expect(
        screen.queryByText(mockSchema.classes[0]!.name)
      ).not.toBeInTheDocument();
    });

    it("should display an error message if the class is not found", async () => {
      // Arrange: Mock the main query to return no data
      vi.mocked(getClass).mockResolvedValue(null);
      renderWithMocks(<ClassStatus {...mockProps} />);

      // Assert: Check that the "Class Not Found" message is displayed
      expect(await screen.findByText("Class Not Found")).toBeInTheDocument();
      expect(
        screen.getByText("The requested class could not be found.")
      ).toBeInTheDocument();
    });
  });

  // ——————————————————————————————————————————
  //    Successful Render & Data Display
  // ——————————————————————————————————————————
  describe("Successful Data Rendering", () => {
    beforeEach(() => {
      // Arrange: Set up all mocks for a successful "happy path" render
      vi.mocked(getClass).mockResolvedValue({
        ...mockSchema.classes[0],
        defaultClass: false,
        id: mockSchema.classes[0]!.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: mockSchema.classes[0]!.name,
        classCode: mockSchema.classes[0]!.classCode,
        year: mockSchema.classes[0]!.year,
        term: mockSchema.classes[0]!.term as "fall" | "spring" | "summer",
        description: mockSchema.classes[0]!.description,
      });
      vi.mocked(getTopicsByClass).mockResolvedValue(
        mockSchema.topics as Topic[]
      );
      vi.mocked(getSchedulesByClass).mockResolvedValue(
        mockSchema.schedules as Schedule[]
      );
      vi.mocked(getEventsBySchedules).mockResolvedValue(
        mockSchema.events as Event[]
      );
      vi.mocked(getDocumentsByClass).mockResolvedValue(
        mockSchema.documents as Document[]
      );
    });

    it("renders class information and data cards correctly", async () => {
      renderWithMocks(<ClassStatus {...mockProps} />);

      // Assert: Check for the main class name
      expect(
        await screen.findByText(mockSchema.classes[0]!.name)
      ).toBeInTheDocument();

      // Assert: Check for cards that should be rendered
      expect(screen.getByText("Document Classification")).toBeInTheDocument();
      expect(screen.getByText("Topics Identified")).toBeInTheDocument();
      expect(screen.getByText("Schedules")).toBeInTheDocument();
      expect(screen.getByText("Upcoming Events")).toBeInTheDocument();

      // Assert: Check for a specific topic and document type
      expect(screen.getByText(mockSchema.topics[0]!.name)).toBeInTheDocument();
      expect(screen.getByText("Homework")).toBeInTheDocument(); // from getDocumentTypeInfo
    });
  });

  // ——————————————————————————————————————————
  //    Dynamic Processing Logic
  // ——————————————————————————————————————————
  describe("Processing Status Logic", () => {
    beforeEach(() => {
      // Basic setup for these tests
      vi.mocked(getClass).mockResolvedValue({
        ...mockSchema.classes[0],
        defaultClass: false,
        id: mockSchema.classes[0]!.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: mockSchema.classes[0]!.name,
        classCode: mockSchema.classes[0]!.classCode,
        year: mockSchema.classes[0]!.year,
        term: mockSchema.classes[0]!.term as "fall" | "spring" | "summer",
        description: mockSchema.classes[0]!.description,
      });
      vi.mocked(getTopicsByClass).mockResolvedValue([]);
      vi.mocked(getSchedulesByClass).mockResolvedValue([]);
      vi.mocked(getEventsBySchedules).mockResolvedValue([]);
    });

    it('should show "complete" status when all documents are classified', async () => {
      // Arrange: All documents have a 'type'
      const allDocsClassified = [
        { ...mockSchema.documents[0]!, type: "syllabus" },
        { ...mockSchema.documents[0]!, id: "doc2", type: "lecture" },
      ] as Document[];
      vi.mocked(getDocumentsByClass).mockResolvedValue(allDocsClassified);

      renderWithMocks(<ClassStatus {...mockProps} />);

      // Assert
      expect(
        await screen.findByText("Processing complete!")
      ).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "100"
      );
      // Check for the green checkmark icon (its parent has the text color class)
      expect(
        screen
          .getByText("Processing complete!")
          .querySelector(".text-green-600")
      ).toBeInTheDocument();
    });

    it('should show "analyzing" status and correct progress at 50%', async () => {
      // Arrange: 1 of 2 documents are classified, making progress exactly 50%
      const someDocsClassified = [
        { ...mockSchema.documents[0]!, type: "lecture" },
        { ...mockSchema.documents[0]!, id: "doc2", type: null }, // One is not classified
      ] as Document[];
      vi.mocked(getDocumentsByClass).mockResolvedValue(someDocsClassified);

      renderWithMocks(<ClassStatus {...mockProps} />);

      // Assert: Check for the correct message for the 50% state
      const titleElement = await screen.findByText(
        "Analyzing document content and structure..."
      );
      expect(titleElement).toBeInTheDocument();

      // Assert the progress bar value
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "50"
      );
      expect(
        screen.getByText("Documents processed: 1 / 2")
      ).toBeInTheDocument();

      // Assert the spinning icon is present
      expect(titleElement.querySelector(".animate-spin")).toBeInTheDocument();
    });

    it('should show "Syllabus detected" badge when a syllabus is found', async () => {
      // Arrange: one document is a syllabus
      const docsWithSyllabus = [
        { ...mockSchema.documents[0]!, type: "syllabus" },
      ] as Document[];
      vi.mocked(getDocumentsByClass).mockResolvedValue(docsWithSyllabus);

      renderWithMocks(<ClassStatus {...mockProps} />);

      // Assert
      expect(await screen.findByText("Syllabus detected")).toBeInTheDocument();
    });
  });

  // ——————————————————————————————————————————
  //    Edge Cases
  // ——————————————————————————————————————————
  describe("Edge Cases", () => {
    it("should not render optional cards if their data is empty", async () => {
      // Arrange: Mock APIs to return empty arrays for optional data
      vi.mocked(getClass).mockResolvedValue({
        ...mockSchema.classes[0],
        defaultClass: false,
        id: mockSchema.classes[0]!.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: mockSchema.classes[0]!.name,
        classCode: mockSchema.classes[0]!.classCode,
        year: mockSchema.classes[0]!.year,
        term: mockSchema.classes[0]!.term as "fall" | "spring" | "summer",
        description: mockSchema.classes[0]!.description,
      });
      vi.mocked(getTopicsByClass).mockResolvedValue([]);
      vi.mocked(getSchedulesByClass).mockResolvedValue([]);
      vi.mocked(getEventsBySchedules).mockResolvedValue([]);
      vi.mocked(getDocumentsByClass).mockResolvedValue([]);

      renderWithMocks(<ClassStatus {...mockProps} />);

      // Assert that the main card is there, but optional ones are not
      expect(await screen.findByText("Class Information")).toBeInTheDocument();

      // Assert that these sections are NOT in the document
      expect(
        screen.queryByText("Document Classification")
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Topics Identified")).not.toBeInTheDocument();
      expect(screen.queryByText("Schedules")).not.toBeInTheDocument();
      expect(screen.queryByText("Upcoming Events")).not.toBeInTheDocument();
    });
  });
});
