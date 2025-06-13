import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import NewStaff from "@/components/management/staff/NewStaff";
import { useSession } from 'next-auth/react';

// Mock external dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

describe("NewStaff", () => {
  let queryClient: QueryClient;
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    (useRouter as any).mockReturnValue({
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
    });

    (useSession as any).mockReturnValue({
      data: { user: { email: 'redacted@purdue.edu' } },
    });
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };

  describe("Rendering", () => {
    it("should render tabs for single user and CSV import", () => {
      renderWithProviders(<NewStaff />);

      expect(
        screen.getByRole("tab", { name: /single user/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: /csv import/i }),
      ).toBeInTheDocument();
    });

    it("should render single user form by default", () => {
      renderWithProviders(<NewStaff />);

      expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it("should show all available roles for admin users", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewStaff />);

      const roleSelect = screen.getByLabelText(/role/i);
      await user.click(roleSelect);

      expect(screen.getByText("Instructional Staff")).toBeInTheDocument();
      expect(screen.getByText("Instructor")).toBeInTheDocument();
      expect(screen.getByText("Teaching Assistant")).toBeInTheDocument();
    });
  });

  describe("Single User Form", () => {
    it("should handle form submission for creating staff", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewStaff />);

      // Fill out the form
      const roleSelect = screen.getByLabelText(/role/i);
      await user.click(roleSelect);
      await user.click(screen.getByText("Instructor"));

      const nameInput = screen.getByLabelText(/full name/i);
      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(nameInput, "Dr. Jane Smith");
      await user.type(usernameInput, "jsmith");
      await user.type(passwordInput, "password123");

      const submitButton = screen.getByRole("button", {
        name: /create instructor/i,
      });
      await user.click(submitButton);

      expect(submitButton).toHaveTextContent("Creating...");
    });

    it("should show role-specific placeholders", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewStaff />);

      const roleSelect = screen.getByLabelText(/role/i);
      await user.click(roleSelect);
      await user.click(screen.getByText("Teaching Assistant"));

      const nameInput = screen.getByLabelText(/full name/i);
      const usernameInput = screen.getByLabelText(/username/i);

      expect(nameInput).toHaveAttribute("placeholder", "John Doe");
      expect(usernameInput).toHaveAttribute("placeholder", "jdoe");
    });

    it("should show role information when role is selected", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewStaff />);

      const roleSelect = screen.getByLabelText(/role/i);
      await user.click(roleSelect);
      await user.click(screen.getByText("Instructional Staff"));

      expect(
        screen.getByText(
          "Will have permissions to manage instructors and teaching assistants.",
        ),
      ).toBeInTheDocument();
    });

    it("should disable submit button when no role is selected", () => {
      renderWithProviders(<NewStaff />);

      expect(
        screen.getByRole("button", { name: /create staff member/i }),
      ).toBeDisabled();
    });

    it("should enable submit button when role is selected", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewStaff />);

      const roleSelect = screen.getByLabelText(/role/i);
      await user.click(roleSelect);
      await user.click(screen.getByText("Instructor"));

      expect(
        screen.getByRole("button", { name: /create instructor/i }),
      ).not.toBeDisabled();
    });
  });

  describe("CSV Import", () => {
    it("should render CSV import tab", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewStaff />);

      const csvTab = screen.getByRole("tab", { name: /csv import/i });
      await user.click(csvTab);

      expect(
        screen.getByRole("button", { name: /download template/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Include the following columns in the CSV file: name, username, password, role, classIds.",
        ),
      ).toBeInTheDocument();
    });

    it("should show available roles for CSV import", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewStaff />);

      const csvTab = screen.getByRole("tab", { name: /csv import/i });
      await user.click(csvTab);

      expect(screen.getByText("Available Roles:")).toBeInTheDocument();
      expect(screen.getByText("instructional")).toBeInTheDocument();
      expect(screen.getByText("instructor")).toBeInTheDocument();
      expect(screen.getByText("ta")).toBeInTheDocument();
    });

    it("should handle file selection", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewStaff />);

      const csvTab = screen.getByRole("tab", { name: /csv import/i });
      await user.click(csvTab);

      const fileInput = screen.getByRole("textbox", { hidden: true });
      expect(fileInput).toHaveAttribute("type", "file");
      expect(fileInput).toHaveAttribute("accept", ".csv");
    });

    it("should download template when button is clicked", async () => {
      // Mock URL.createObjectURL and related methods
      const mockCreateObjectURL = vi.fn(() => "mock-url");
      const mockRevokeObjectURL = vi.fn();
      const mockClick = vi.fn();

      Object.defineProperty(window, "URL", {
        value: {
          createObjectURL: mockCreateObjectURL,
          revokeObjectURL: mockRevokeObjectURL,
        },
      });

      const mockCreateElement = vi.fn(() => ({
        href: "",
        download: "",
        click: mockClick,
      }));

      Object.defineProperty(document, "createElement", {
        value: mockCreateElement,
      });

      const user = userEvent.setup();
      renderWithProviders(<NewStaff />);

      const csvTab = screen.getByRole("tab", { name: /csv import/i });
      await user.click(csvTab);

      const downloadButton = screen.getByRole("button", {
        name: /download template/i,
      });
      await user.click(downloadButton);

      expect(mockCreateElement).toHaveBeenCalledWith("a");
      expect(mockClick).toHaveBeenCalled();
    });

    it("should show CSV preview when file is selected", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewStaff />);

      const csvTab = screen.getByRole("tab", { name: /csv import/i });
      await user.click(csvTab);

      // Mock FileReader
      const mockFileReader = {
        readAsText: vi.fn(),
        onload: null as any,
        result:
          "name,username,password,role,classIds\nDr. Jane Smith,jsmith,password123,instructor,class1;class2",
      };

      vi.spyOn(window, "FileReader").mockImplementation(
        () => mockFileReader as any,
      );

      const fileInput = screen.getByRole("textbox", { hidden: true });
      const file = new File(["test"], "test.csv", { type: "text/csv" });

      await user.upload(fileInput, file);

      // Simulate FileReader onload
      if (mockFileReader.onload) {
        mockFileReader.onload({
          target: { result: mockFileReader.result },
        } as any);
      }

      await waitFor(() => {
        expect(screen.getByText("Preview (1 users)")).toBeInTheDocument();
        expect(screen.getByText("Dr. Jane Smith")).toBeInTheDocument();
        expect(screen.getByText("jsmith")).toBeInTheDocument();
      });
    });
  });

  describe("Form Validation and Error Handling", () => {
    it("should require all form fields", () => {
      renderWithProviders(<NewStaff />);

      expect(screen.getByLabelText(/full name/i)).toHaveAttribute("required");
      expect(screen.getByLabelText(/username/i)).toHaveAttribute("required");
      expect(screen.getByLabelText(/password/i)).toHaveAttribute("required");
    });

    it("should navigate to staff page after successful creation", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewStaff />);

      // Fill and submit form
      const roleSelect = screen.getByLabelText(/role/i);
      await user.click(roleSelect);
      await user.click(screen.getByText("Instructor"));

      await user.type(screen.getByLabelText(/full name/i), "Dr. Jane Smith");
      await user.type(screen.getByLabelText(/username/i), "jsmith");
      await user.type(screen.getByLabelText(/password/i), "password123");

      const submitButton = screen.getByRole("button", {
        name: /create instructor/i,
      });
      await user.click(submitButton);

      // Wait for navigation
      await waitFor(
        () => {
          expect(mockPush).toHaveBeenCalledWith("/management/staff");
        },
        { timeout: 2000 },
      );
    });

    it("should handle CSV submission", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewStaff />);

      const csvTab = screen.getByRole("tab", { name: /csv import/i });
      await user.click(csvTab);

      // Mock FileReader and file upload
      const mockFileReader = {
        readAsText: vi.fn(),
        onload: null as any,
        result:
          "name,username,password,role,classIds\nDr. Jane Smith,jsmith,password123,instructor,class1;class2",
      };

      vi.spyOn(window, "FileReader").mockImplementation(
        () => mockFileReader as any,
      );

      const fileInput = screen.getByRole("textbox", { hidden: true });
      const file = new File(["test"], "test.csv", { type: "text/csv" });

      await user.upload(fileInput, file);

      // Simulate FileReader onload
      if (mockFileReader.onload) {
        mockFileReader.onload({
          target: { result: mockFileReader.result },
        } as any);
      }

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /create 1 staff members/i }),
        ).toBeInTheDocument();
      });

      const submitButton = screen.getByRole("button", {
        name: /create 1 staff members/i,
      });
      await user.click(submitButton);

      expect(submitButton).toHaveTextContent("Creating...");
    });

    it("should handle CSV file removal", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewStaff />);

      const csvTab = screen.getByRole("tab", { name: /csv import/i });
      await user.click(csvTab);

      // Mock FileReader and file upload
      const mockFileReader = {
        readAsText: vi.fn(),
        onload: null as any,
        result:
          "name,username,password,role,classIds\nDr. Jane Smith,jsmith,password123,instructor,class1;class2",
      };

      vi.spyOn(window, "FileReader").mockImplementation(
        () => mockFileReader as any,
      );

      const fileInput = screen.getByRole("textbox", { hidden: true });
      const file = new File(["test"], "test.csv", { type: "text/csv" });

      await user.upload(fileInput, file);

      // Simulate FileReader onload
      if (mockFileReader.onload) {
        mockFileReader.onload({
          target: { result: mockFileReader.result },
        } as any);
      }

      await waitFor(() => {
        expect(screen.getByText("Selected file:")).toBeInTheDocument();
      });

      // Remove file
      const removeButton = screen.getByRole("button", { name: "" }); // X button
      await user.click(removeButton);

      expect(screen.queryByText("Selected file:")).not.toBeInTheDocument();
    });
  });

  describe("Role-specific Functionality", () => {
    it("should show different placeholders for different roles", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewStaff />);

      // Test instructional staff
      const roleSelect = screen.getByLabelText(/role/i);
      await user.click(roleSelect);
      await user.click(screen.getByText("Instructional Staff"));

      expect(screen.getByLabelText(/full name/i)).toHaveAttribute(
        "placeholder",
        "Dr. Sarah Johnson",
      );
      expect(screen.getByLabelText(/username/i)).toHaveAttribute(
        "placeholder",
        "sjohnson",
      );

      // Test instructor
      await user.click(roleSelect);
      await user.click(screen.getByText("Instructor"));

      expect(screen.getByLabelText(/full name/i)).toHaveAttribute(
        "placeholder",
        "Dr. Jane Smith",
      );
      expect(screen.getByLabelText(/username/i)).toHaveAttribute(
        "placeholder",
        "jsmith",
      );
    });

    it("should show role-specific permissions text", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewStaff />);

      const roleSelect = screen.getByLabelText(/role/i);

      // Test instructor permissions
      await user.click(roleSelect);
      await user.click(screen.getByText("Instructor"));

      expect(
        screen.getByText(
          "Will have permissions to manage assigned classes and teaching assistants.",
        ),
      ).toBeInTheDocument();

      // Test TA permissions
      await user.click(roleSelect);
      await user.click(screen.getByText("Teaching Assistant"));

      expect(
        screen.getByText(
          "Will have permissions to assist with assigned classes.",
        ),
      ).toBeInTheDocument();
    });

    it("should update submit button text based on selected role", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewStaff />);

      const roleSelect = screen.getByLabelText(/role/i);

      // Test instructor
      await user.click(roleSelect);
      await user.click(screen.getByText("Instructor"));

      expect(
        screen.getByRole("button", { name: /create instructor/i }),
      ).toBeInTheDocument();

      // Test TA
      await user.click(roleSelect);
      await user.click(screen.getByText("Teaching Assistant"));

      expect(
        screen.getByRole("button", { name: /create teaching assistant/i }),
      ).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for NewStaff:
 * Path: management/staff/NewStaff.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None detected
 * - Client component: false
 * - Uses hooks: useRouter, useState, useMemo
 * - Uses router: true
 * - Has API calls: false (simulated)
 * - Has form handling: true
 * - Uses state: true
 * - Uses effects: false
 * - Uses context: false
 *
 * The component supports both single user creation and CSV bulk import,
 * with simplified access control since only admins can access this screen.
 */
