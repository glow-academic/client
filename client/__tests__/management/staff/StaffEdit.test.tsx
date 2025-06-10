import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import StaffEdit from '@/components/management/staff/StaffEdit';

// Mock external dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock API calls
vi.mock('@/utils/queries/users/get-all-users', () => ({
  getAllUsers: vi.fn(),
}));

describe('StaffEdit', () => {
  let queryClient: QueryClient;
  const mockPush = vi.fn();
  const testUserId = 'test-user-id';
  
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
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };

  const mockTargetUser = {
    id: testUserId,
    name: 'Dr. Jane Smith',
    username: 'jsmith',
    role: 'instructor',
    classIds: ['class1', 'class2'],
  };

  const mockAllUsers = [mockTargetUser];

  describe('Rendering', () => {
    it('should render loading state initially', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockImplementation(() => new Promise(() => {})); // Never resolves

      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render user not found when user does not exist', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue([]); // Target user not in list

      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByText('User Not Found')).toBeInTheDocument();
        expect(screen.getByText('The requested user could not be found.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /back to staff management/i })).toBeInTheDocument();
      });
    });

    it('should render invalid user type for non-staff users', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      const studentUser = { ...mockTargetUser, role: 'student' };
      
      (getAllUsers as any).mockResolvedValue([studentUser]);

      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Invalid User Type')).toBeInTheDocument();
        expect(screen.getByText('This user is not a staff member and cannot be edited here.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /back to staff management/i })).toBeInTheDocument();
      });
    });

    it('should render edit form for staff users', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockAllUsers);

      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Edit Instructor')).toBeInTheDocument();
        expect(screen.getByText('Modify the details for Dr. Jane Smith.')).toBeInTheDocument();
        expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });
    });

    it('should show back button in header', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockAllUsers);

      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
      });
    });
  });

  describe('Form Functionality', () => {
    it('should populate form with existing user data', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockAllUsers);

      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Dr. Jane Smith')).toBeInTheDocument();
        expect(screen.getByDisplayValue('jsmith')).toBeInTheDocument();
      });
    });

    it('should handle form input changes', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Dr. Jane Smith')).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/full name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Dr. Jane Updated');

      expect(screen.getByDisplayValue('Dr. Jane Updated')).toBeInTheDocument();
    });

    it('should enable save button when changes are made', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
      });

      const nameInput = screen.getByLabelText(/full name/i);
      await user.type(nameInput, ' Updated');

      expect(screen.getByRole('button', { name: /save changes/i })).not.toBeDisabled();
    });

    it('should handle form submission', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Dr. Jane Smith')).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/full name/i);
      await user.type(nameInput, ' Updated');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      expect(screen.getByRole('button', { name: /saving.../i })).toBeInTheDocument();
    });

    it('should navigate back on cancel', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockPush).toHaveBeenCalledWith('/management/staff');
    });

    it('should navigate back on header back button', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      expect(mockPush).toHaveBeenCalledWith('/management/staff');
    });
  });

  describe('Password Management', () => {
    it('should show password field for all users', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockAllUsers);

      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
        expect(screen.getByText('Leave blank to keep the current password.')).toBeInTheDocument();
      });
    });

    it('should handle password changes', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/new password/i);
      await user.type(passwordInput, 'newpassword123');

      expect(passwordInput).toHaveValue('newpassword123');
    });
  });

  describe('Role and Permissions Display', () => {
    it('should display role information card', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockAllUsers);

      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Role & Permissions')).toBeInTheDocument();
        expect(screen.getByText('Current role and access level information.')).toBeInTheDocument();
        expect(screen.getByText('Instructor')).toBeInTheDocument();
        expect(screen.getByText('2 classes assigned')).toBeInTheDocument();
        expect(screen.getByText('Can manage assigned classes and teaching assistants')).toBeInTheDocument();
      });
    });

    it('should show correct role icon and badge for instructional staff', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      const instructionalUser = { ...mockTargetUser, role: 'instructional' };
      
      (getAllUsers as any).mockResolvedValue([instructionalUser]);

      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Edit Instructional Staff')).toBeInTheDocument();
        expect(screen.getByText('Instructional Staff')).toBeInTheDocument();
      });
    });

    it('should show correct role icon and badge for teaching assistant', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      const taUser = { ...mockTargetUser, role: 'ta' };
      
      (getAllUsers as any).mockResolvedValue([taUser]);

      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Edit Teaching Assistant')).toBeInTheDocument();
        expect(screen.getByText('Teaching Assistant')).toBeInTheDocument();
      });
    });
  });

  describe('Delete Functionality', () => {
    it('should show delete section for all users', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockAllUsers);

      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Danger Zone')).toBeInTheDocument();
        expect(screen.getByText('Permanently delete this user account. This action cannot be undone.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /delete user/i })).toBeInTheDocument();
      });
    });

    it('should show delete confirmation dialog', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete user/i })).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete user/i });
      await user.click(deleteButton);

      expect(screen.getByText('Are you absolutely sure?')).toBeInTheDocument();
      expect(screen.getByText(/This will permanently delete the user account for Dr. Jane Smith/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete user/i })).toBeInTheDocument();
    });

    it('should handle delete confirmation', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete user/i })).toBeInTheDocument();
      });

      // Open delete dialog and confirm
      const deleteButton = screen.getByRole('button', { name: /delete user/i });
      await user.click(deleteButton);

      const confirmDeleteButton = screen.getAllByRole('button', { name: /delete user/i })[1]; // Second one in dialog
      await user.click(confirmDeleteButton);

      // Should show loading state
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/management/staff');
      }, { timeout: 2000 });
    });
  });

  describe('Navigation and Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockRejectedValue(new Error('API Error'));

      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      // Should show loading state and not crash
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should navigate to staff page after successful update', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Dr. Jane Smith')).toBeInTheDocument();
      });

      // Make a change and submit
      const nameInput = screen.getByLabelText(/full name/i);
      await user.type(nameInput, ' Updated');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      // Wait for navigation
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/management/staff');
      }, { timeout: 2000 });
    });

    it('should handle back navigation from error states', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue([]);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit userId={testUserId} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to staff management/i })).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /back to staff management/i });
      await user.click(backButton);

      expect(mockPush).toHaveBeenCalledWith('/management/staff');
    });
  });
});

/*
 * Component Analysis for StaffEdit:
 * Path: management/staff/StaffEdit.tsx
 * 
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true (userId: string)
 * - Props interface: { userId: string }
 * - Client component: false
 * - Uses hooks: useRouter, useQuery, useState, useEffect
 * - Uses router: true
 * - Has API calls: true (getAllUsers)
 * - Has form handling: true
 * - Uses state: true
 * - Uses effects: true
 * - Uses context: false
 * 
 * The component provides comprehensive staff editing functionality with
 * simplified access control since only admins can access this screen.
 */
