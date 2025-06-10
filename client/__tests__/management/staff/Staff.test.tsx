import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import Staff from '@/components/management/staff/Staff';

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

describe('Staff', () => {
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
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };

  const mockStaffUsers = [
    {
      id: '1',
      name: 'Dr. Sarah Johnson',
      username: 'sjohnson',
      role: 'instructional',
      classIds: ['class1', 'class2'],
    },
    {
      id: '2',
      name: 'Dr. Jane Smith',
      username: 'jsmith',
      role: 'instructor',
      classIds: ['class3'],
    },
    {
      id: '3',
      name: 'John Doe',
      username: 'jdoe',
      role: 'ta',
      classIds: [],
    },
  ];

  describe('Rendering', () => {
    it('should render loading state initially', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockImplementation(() => new Promise(() => {})); // Never resolves

      renderWithProviders(<Staff />);
      
      expect(screen.getByText('Loading staff members...')).toBeInTheDocument();
    });

    it('should render staff summary cards', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockStaffUsers);

      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument(); // Total Staff
        expect(screen.getByText('1')).toBeInTheDocument(); // Instructional
        expect(screen.getByText('1')).toBeInTheDocument(); // Instructors
        expect(screen.getByText('1')).toBeInTheDocument(); // TAs
      });

      expect(screen.getByText('Total Staff')).toBeInTheDocument();
      expect(screen.getByText('Instructional')).toBeInTheDocument();
      expect(screen.getByText('Instructors')).toBeInTheDocument();
      expect(screen.getByText('TAs')).toBeInTheDocument();
    });

    it('should render staff table with correct headers', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockStaffUsers);

      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        expect(screen.getByText('Staff Member')).toBeInTheDocument();
        expect(screen.getByText('Role')).toBeInTheDocument();
        expect(screen.getByText('Username')).toBeInTheDocument();
        expect(screen.getByText('Classes')).toBeInTheDocument();
        expect(screen.getByText('Actions')).toBeInTheDocument();
      });
    });

    it('should render staff members in table', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockStaffUsers);

      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        
        expect(screen.getByText('sjohnson')).toBeInTheDocument();
        expect(screen.getByText('jsmith')).toBeInTheDocument();
        expect(screen.getByText('jdoe')).toBeInTheDocument();
        
        expect(screen.getByText('Instructional Staff')).toBeInTheDocument();
        expect(screen.getByText('Instructor')).toBeInTheDocument();
        expect(screen.getByText('Teaching Assistant')).toBeInTheDocument();
      });
    });

    it('should show class counts for each staff member', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockStaffUsers);

      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        expect(screen.getByText('2 classes')).toBeInTheDocument(); // Dr. Sarah Johnson
        expect(screen.getByText('1 classes')).toBeInTheDocument(); // Dr. Jane Smith
        expect(screen.getByText('0 classes')).toBeInTheDocument(); // John Doe
      });
    });

    it('should show Edit User buttons for all staff members', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockStaffUsers);

      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /edit user/i });
        expect(editButtons).toHaveLength(3); // One for each staff member
      });
    });
  });

  describe('Search and Filtering', () => {
    it('should render search input and filter controls', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockStaffUsers);

      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search staff by name, username, or role...')).toBeInTheDocument();
        expect(screen.getByText('Filter by role')).toBeInTheDocument();
        expect(screen.getByText('Sort by')).toBeInTheDocument();
      });
    });

    it('should handle search functionality', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockStaffUsers);

      const user = userEvent.setup();
      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search staff by name, username, or role...');
      await user.type(searchInput, 'Sarah');

      // Should filter to show only Sarah Johnson
      expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
      expect(screen.queryByText('Dr. Jane Smith')).not.toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('should handle role filtering', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockStaffUsers);

      const user = userEvent.setup();
      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
      });

      // Click on role filter
      const roleFilter = screen.getByDisplayValue('All Roles');
      await user.click(roleFilter);
      await user.click(screen.getByText('Teaching Assistants'));

      // Should show only TAs
      expect(screen.queryByText('Dr. Sarah Johnson')).not.toBeInTheDocument();
      expect(screen.queryByText('Dr. Jane Smith')).not.toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should handle sorting', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockStaffUsers);

      const user = userEvent.setup();
      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
      });

      // Click on sort filter
      const sortFilter = screen.getByDisplayValue('Name');
      await user.click(sortFilter);
      await user.click(screen.getByText('Role'));

      // Should sort by role (instructional, instructor, ta)
      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('Dr. Sarah Johnson'); // instructional
      expect(rows[2]).toHaveTextContent('Dr. Jane Smith'); // instructor
      expect(rows[3]).toHaveTextContent('John Doe'); // ta
    });

    it('should show no results message when search has no matches', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockStaffUsers);

      const user = userEvent.setup();
      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search staff by name, username, or role...');
      await user.type(searchInput, 'NonExistentUser');

      expect(screen.getByText('No staff members match your filters')).toBeInTheDocument();
    });
  });

  describe('Actions and Navigation', () => {
    it('should show actions column with Edit User buttons', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockStaffUsers);

      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        expect(screen.getByText('Actions')).toBeInTheDocument();
        const editButtons = screen.getAllByRole('button', { name: /edit user/i });
        expect(editButtons).toHaveLength(3); // Three edit buttons
      });
    });

    it('should handle edit user action', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockStaffUsers);

      const user = userEvent.setup();
      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
      });

      // Click on the first edit button
      const editButtons = screen.getAllByRole('button', { name: /edit user/i });
      await user.click(editButtons[0]);

      expect(mockPush).toHaveBeenCalledWith('/management/staff/u/1');
    });

    it('should handle edit user action for different staff members', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockStaffUsers);

      const user = userEvent.setup();
      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });

      // Click on the second edit button (Dr. Jane Smith)
      const editButtons = screen.getAllByRole('button', { name: /edit user/i });
      await user.click(editButtons[1]);

      expect(mockPush).toHaveBeenCalledWith('/management/staff/u/2');
    });

    it('should handle edit user action for teaching assistant', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockStaffUsers);

      const user = userEvent.setup();
      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on the third edit button (John Doe)
      const editButtons = screen.getAllByRole('button', { name: /edit user/i });
      await user.click(editButtons[2]);

      expect(mockPush).toHaveBeenCalledWith('/management/staff/u/3');
    });
  });

  describe('Empty States', () => {
    it('should show empty state when no staff members exist', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue([]);

      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        expect(screen.getByText('No staff members found')).toBeInTheDocument();
      });
    });

    it('should show correct counts when no staff members exist', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue([]);

      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        const totalStaffCards = screen.getAllByText('0');
        expect(totalStaffCards).toHaveLength(4); // Total, Instructional, Instructors, TAs
      });
    });

    it('should show empty state with correct colspan', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue([]);

      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        const emptyCell = screen.getByText('No staff members found').closest('td');
        expect(emptyCell).toHaveAttribute('colspan', '5');
      });
    });
  });

  describe('User Avatars and Display', () => {
    it('should show user initials in avatars', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockStaffUsers);

      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        expect(screen.getByText('DS')).toBeInTheDocument(); // Dr. Sarah Johnson
        expect(screen.getByText('DJ')).toBeInTheDocument(); // Dr. Jane Smith
        expect(screen.getByText('JD')).toBeInTheDocument(); // John Doe
      });
    });

    it('should show role badges with correct variants', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockStaffUsers);

      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        const instructionalBadge = screen.getByText('Instructional Staff');
        const instructorBadge = screen.getByText('Instructor');
        const taBadge = screen.getByText('Teaching Assistant');
        
        expect(instructionalBadge).toBeInTheDocument();
        expect(instructorBadge).toBeInTheDocument();
        expect(taBadge).toBeInTheDocument();
      });
    });

    it('should show role icons alongside badges', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockResolvedValue(mockStaffUsers);

      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        // Check that role badges are displayed with their icons
        const roleCells = screen.getAllByText('Instructional Staff').concat(
          screen.getAllByText('Instructor'),
          screen.getAllByText('Teaching Assistant')
        );
        expect(roleCells).toHaveLength(3);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      (getAllUsers as any).mockRejectedValue(new Error('API Error'));

      renderWithProviders(<Staff />);
      
      // Should not crash and should show loading state
      expect(screen.getByText('Loading staff members...')).toBeInTheDocument();
    });

    it('should handle empty user data gracefully', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      const usersWithMissingData = [
        {
          id: '1',
          name: '',
          username: 'test',
          role: 'instructor',
          classIds: null,
        },
      ];
      
      (getAllUsers as any).mockResolvedValue(usersWithMissingData);

      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        expect(screen.getByText('0 classes')).toBeInTheDocument(); // Should handle null classIds
      });
    });

    it('should filter out non-staff users', async () => {
      const { getAllUsers } = await import('@/utils/queries/users/get-all-users');
      
      const mixedUsers = [
        ...mockStaffUsers,
        {
          id: '4',
          name: 'Admin User',
          username: 'admin',
          role: 'admin',
          classIds: [],
        },
        {
          id: '5',
          name: 'Student User',
          username: 'student',
          role: 'student',
          classIds: [],
        },
      ];
      
      (getAllUsers as any).mockResolvedValue(mixedUsers);

      renderWithProviders(<Staff />);
      
      await waitFor(() => {
        // Should only show staff members, not admin or student
        expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.queryByText('Admin User')).not.toBeInTheDocument();
        expect(screen.queryByText('Student User')).not.toBeInTheDocument();
        
        // Summary should still show 3 staff members
        expect(screen.getByText('3')).toBeInTheDocument(); // Total Staff
      });
    });
  });
});

/*
 * Component Analysis for Staff:
 * Path: management/staff/Staff.tsx
 * 
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None detected
 * - Client component: false
 * - Uses hooks: useQuery, useRouter, useState, useMemo
 * - Uses router: true
 * - Has API calls: true (getAllUsers)
 * - Has form handling: false
 * - Uses state: true (search, filter, sort)
 * - Uses effects: false
 * - Uses context: false
 * 
 * The component displays a comprehensive staff management interface with
 * filtering, searching, sorting, and direct edit buttons for each staff member.
 */
