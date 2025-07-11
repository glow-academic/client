import { screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithMocks } from '@/test/renderWithMocks'; // Assuming renderWithMocks exports these
import userEvent from '@testing-library/user-event';
import { routerMock } from '@/mocks/navigation';

// ——————————————————————————————————————————
import ClassesGeneralPage from '@/components/create/classes/Classes'; // Corrected import path
// ——————————————————————————————————————————

// Mock data that matches the expected structure for a class
const mockClasses = [
  {
    id: 'cl_123',
    name: 'Introduction to Psychology',
    classCode: 'PSY101',
    term: 'fall',
    year: 2025,
    description: 'A comprehensive overview of the major fields of psychology.',
    createdAt: new Date('2025-01-15T10:00:00Z').toISOString(),
  },
  {
    id: 'cl_456',
    name: 'Advanced Calculus',
    classCode: 'MATH300',
    term: 'spring',
    year: 2026,
    description: 'Topics include multivariable calculus and differential equations.',
    createdAt: new Date('2025-02-20T11:30:00Z').toISOString(),
  },
];


describe('ClassesGeneralPage', () => {

  // This test ensures the component renders the data it gets from the API.
  describe('Basic Rendering', () => {
    it('should render class cards when the API returns data', async () => {
      // Arrange: Mock the API to return our list of classes.
      renderWithMocks(
        <ClassesGeneralPage  />,
        {
          queries: { getAllClasses: mockClasses },
          mutations: { deleteClass: vi.fn() },
        }
      );

      // Act & Assert: Check if the content from our mock data is on the screen.
      // 'findBy' is used to wait for the async query to resolve.
      expect(await screen.findByText('Introduction to Psychology')).toBeTruthy();
      expect(screen.getByText('PSY101')).toBeTruthy();
      expect(screen.getByText('Fall 2025')).toBeTruthy();

      expect(await screen.findByText('Advanced Calculus')).toBeTruthy();
      expect(screen.getByText('MATH300')).toBeTruthy();
      expect(screen.getByText('Spring 2026')).toBeTruthy();
    });
  });

  // These tests simulate a user clicking buttons.
  describe('User Interactions & Deletion Flow', () => {
    
    it('should open the delete confirmation dialog when the delete button is clicked', async () => {
      const user = userEvent.setup();
      renderWithMocks(
        <ClassesGeneralPage />,
        {
          queries: { getAllClasses: () => Promise.resolve(mockClasses) },
          mutations: { deleteClass: vi.fn() },
        }
      );
      
      // Arrange: Wait for the cards to render, then find all delete buttons.
      const deleteButtons = await screen.findAllByRole('button', { name: /Delete Introduction to Psychology/i });
      
      // Act: Click the delete button on the first class card.
      await user.click(deleteButtons[0] as Element);

      // Assert: The confirmation dialog should now be visible.
      expect(await screen.findByRole('alertdialog')).toBeTruthy();
      expect(screen.getByText('Are you sure you want to delete this class?')).toBeTruthy();
    });

    it('should call the delete mutation when deletion is confirmed', async () => {
      const user = userEvent.setup();
      const mockDeleteFn = vi.fn().mockResolvedValue({}); // Mock the API call
      
      renderWithMocks(
        <ClassesGeneralPage />,
        {
          queries: { getAllClasses: () => Promise.resolve(mockClasses) },
          mutations: { deleteClass: mockDeleteFn },
        }
      );
      
      // Arrange: Click the delete icon to open the dialog.
      const deleteButtons = await screen.findAllByRole('button', { name: /Delete Introduction to Psychology/i });
      await user.click(deleteButtons[0] as Element);
      
      // Act: Find the final confirmation button in the dialog and click it.
      const confirmButton = await screen.findByRole('button', { name: "Delete" });
      await user.click(confirmButton);
      
      // Assert: Check that our API mutation function was called with the correct ID.
      expect(mockDeleteFn).toHaveBeenCalledWith('cl_123');
      
      // Assert: After mutation, the dialog should close.
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).toBeNull();
      });
    });
  });

  // This test checks if the app navigates correctly.
  describe('Navigation', () => {
    it('should navigate to the edit page when the edit button is clicked', async () => {
      const user = userEvent.setup();
      renderWithMocks(
        <ClassesGeneralPage />,
        {
          queries: { getAllClasses: () => Promise.resolve(mockClasses) },
        }
      );

      // Arrange: Wait for cards to render and find the edit buttons.
      const editButtons = await screen.findAllByRole('button', { name: /Edit Advanced Calculus/i });
      
      // Act: Click the edit button for the second class ('Advanced Calculus').
      await user.click(editButtons[1] as Element);

      // Assert: Check if the router's push method was called with the correct URL.
      expect(routerMock.push).toHaveBeenCalledWith('/create/classes/c/cl_456');
    });
  });

  // This test checks how the component behaves in non-ideal scenarios.
  describe('Edge Cases', () => {
    it('should display nothing if no classes are returned', () => {
      // Arrange: Mock the API to return an empty array.
      renderWithMocks(
        <ClassesGeneralPage />,
        {
          queries: { getAllClasses: () => Promise.resolve([]) },
        }
      );

      // Assert: Check that the class names are NOT in the document.
      // 'queryBy' is used because it returns null instead of throwing an error if not found.
      expect(screen.queryByText('Introduction to Psychology')).toBeNull();
      expect(screen.queryByText('Advanced Calculus')).toBeNull();
    });

    it('should render nothing if the API call fails', async () => {
      // Mock the console.error to prevent logs from cluttering the test output
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Arrange: Mock the API to simulate a failure.
      renderWithMocks(
        <ClassesGeneralPage />,
        {
          queries: { getAllClasses: () => Promise.reject(new Error('Network Error')) },
        }
      );

      // Assert: The component should handle the error gracefully and not render the cards.
      await waitFor(() => {
        expect(screen.queryByText('Introduction to Psychology')).toBeNull();
      });
      
      // Clean up the spy
      consoleErrorSpy.mockRestore();
    });
  });
});