import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ClassEdit, { ClassEditProps } from "@/components/classes/ClassEdit";
import { renderWithMocks } from "@/test/renderWithMocks";

// --- Mocks Setup ---
// 1. Mock the child component to isolate the parent for testing.
// We'll make the mock display the props it receives so we can check them.
vi.mock("@/components/common/class/ClassForm", () => ({
  default: ({ classId }: { classId: string }) => (
    <div data-testid="class-form-mock">{`ClassForm rendered with ID: ${classId}`}</div>
  ),
}));

// 2. Define the props we'll pass to ClassEdit.
const mockProps: ClassEditProps = {
  classId: "test-class-123",
};

// --- Tests ---
describe("ClassEdit", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the ClassForm component and passes the correct classId prop", () => {
    // Arrange: Render the component with mock props.
    renderWithMocks(<ClassEdit {...mockProps} />);

    // Assert: Check that our mocked ClassForm is on the screen.
    const classFormMock = screen.getByTestId("class-form-mock");
    expect(classFormMock).toBeInTheDocument();

    // Assert: Check that the mock received and rendered the correct classId.
    // This confirms the prop was passed down successfully.
    expect(
      screen.getByText("ClassForm rendered with ID: test-class-123")
    ).toBeInTheDocument();
  });
});
