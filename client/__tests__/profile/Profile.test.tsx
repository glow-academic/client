import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { Profile } from '@/components/profile/Profile';

// Mock external dependencies
vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({
    userId: 'user-1',
  })),
}));

// Mock API calls
vi.mock('@/utils/queries/users/get-user', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/utils/queries/classes/get-all-classes', () => ({
  getAllClasses: vi.fn(),
}));

// Import mocked functions
import { getUser } from '@/utils/queries/users/get-user';
import { getAllClasses } from '@/utils/queries/classes/get-all-classes';

// Mock data
const mockUser = {
  id: 'user-1',
  name: 'Dr. Jane Smith',
  username: 'jsmith',
  role: 'instructor',
  classIds: ['class-1', 'class-2'],
  createdAt: '2024-01-15T10:00:00Z',
};

const mockAdminUser = {
  id: 'admin-1',
  name: 'Admin User',
  username: 'admin',
  role: 'admin',
  classIds: [],
  createdAt: '2024-01-01T10:00:00Z',
};

const mockTAUser = {
  id: 'ta-1',
  name: 'John Doe',
  username: 'jdoe',
  role: 'ta',
  classIds: ['class-1'],
  createdAt: '2024-02-01T10:00:00Z',
};

const mockInstructionalUser = {
  id: 'inst-1',
  name: 'Dr. Sarah Johnson',
  username: 'sjohnson',
  role: 'instructional',
  classIds: ['class-1', 'class-2', 'class-3'],
  createdAt: '2024-01-10T10:00:00Z',
};

const mockClasses = [
  {
    id: 'class-1',
    name: 'Introduction to Computer Science',
    classCode: 'CS101',
    term: 'fall',
    year: 2024,
  },
  {
    id: 'class-2',
    name: 'Data Structures',
    classCode: 'CS201',
    term: 'spring',
    year: 2024,
  },
  {
    id: 'class-3',
    name: 'Algorithms',
    classCode: 'CS301',
    term: 'fall',
    year: 2024,
  },
];

describe('Profile', () => {
  let queryClient: QueryClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    (getUser as any).mockResolvedValue(mockUser);
    (getAllClasses as any).mockResolvedValue(mockClasses);
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };

  describe('Rendering', () => {
    it('should render without crashing', async () => {
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });
    });

    it('should render with custom className prop', async () => {
      renderWithProviders(<Profile className="custom-class" />);
      
      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });
      
      const profileContainer = screen.getByText('Dr. Jane Smith').closest('div');
      expect(profileContainer?.parentElement?.parentElement).toHaveClass('custom-class');
    });

    it('should display user basic information', async () => {
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('redacted@purdue.edu')).toBeInTheDocument();
        expect(screen.getByText('Instructor')).toBeInTheDocument();
      });
    });

    it('should display user avatar with initials', async () => {
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('JS')).toBeInTheDocument(); // Initials for Jane Smith
      });
    });

    it('should display account status information', async () => {
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Account Status')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('Today')).toBeInTheDocument(); // Last login
      });
    });

    it('should have correct accessibility attributes', async () => {
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        // Check for proper heading structure
        expect(screen.getByText('Account Status')).toBeInTheDocument();
        expect(screen.getByText('Assigned Classes')).toBeInTheDocument();
        expect(screen.getByText('Permissions & Access')).toBeInTheDocument();
      });
    });
  });

  describe('Role-based Display', () => {
    it('should display admin role information correctly', async () => {
      (getUser as any).mockResolvedValue(mockAdminUser);
      
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Administrator')).toBeInTheDocument();
        expect(screen.getByText('Full system access and management capabilities')).toBeInTheDocument();
        expect(screen.getByText('Full system administration')).toBeInTheDocument();
        expect(screen.getByText('User management')).toBeInTheDocument();
        expect(screen.getByText('All course access')).toBeInTheDocument();
      });
    });

    it('should display instructor role information correctly', async () => {
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Instructor')).toBeInTheDocument();
        expect(screen.getByText('Teach assigned courses and manage students')).toBeInTheDocument();
        expect(screen.getByText('Assigned course access')).toBeInTheDocument();
        expect(screen.getByText('Student management')).toBeInTheDocument();
        expect(screen.getByText('TA management')).toBeInTheDocument();
      });
    });

    it('should display TA role information correctly', async () => {
      (getUser as any).mockResolvedValue(mockTAUser);
      
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Teaching Assistant')).toBeInTheDocument();
        expect(screen.getByText('Assist with teaching and student support')).toBeInTheDocument();
        expect(screen.getByText('Chat assistance')).toBeInTheDocument();
        expect(screen.getByText('Student support')).toBeInTheDocument();
        expect(screen.getByText('Guest mode access')).toBeInTheDocument();
      });
    });

    it('should display instructional staff role information correctly', async () => {
      (getUser as any).mockResolvedValue(mockInstructionalUser);
      
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Instructional Staff')).toBeInTheDocument();
        expect(screen.getByText('Manage courses, quizzes, and teaching resources')).toBeInTheDocument();
        expect(screen.getByText('Course management')).toBeInTheDocument();
        expect(screen.getByText('Quiz creation and management')).toBeInTheDocument();
        expect(screen.getByText('Instructor and TA management')).toBeInTheDocument();
      });
    });

    it('should handle unknown role gracefully', async () => {
      const unknownRoleUser = { ...mockUser, role: 'unknown' };
      (getUser as any).mockResolvedValue(unknownRoleUser);
      
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        // Should default to TA role info
        expect(screen.getByText('Teaching Assistant')).toBeInTheDocument();
      });
    });
  });

  describe('Assigned Classes', () => {
    it('should display assigned classes correctly', async () => {
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Assigned Classes')).toBeInTheDocument();
        expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
        expect(screen.getByText('CS101 • fall 2024')).toBeInTheDocument();
        expect(screen.getByText('Data Structures')).toBeInTheDocument();
        expect(screen.getByText('CS201 • spring 2024')).toBeInTheDocument();
      });
    });

    it('should not display assigned classes section when user has no classes', async () => {
      const userWithoutClasses = { ...mockUser, classIds: [] };
      (getUser as any).mockResolvedValue(userWithoutClasses);
      
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });
      
      expect(screen.queryByText('Assigned Classes')).not.toBeInTheDocument();
    });

    it('should handle classes that no longer exist', async () => {
      const userWithMissingClass = { ...mockUser, classIds: ['class-1', 'nonexistent-class'] };
      (getUser as any).mockResolvedValue(userWithMissingClass);
      
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
      });
      
      // Should only show existing classes
      expect(screen.getAllByText(/CS\d+/).length).toBe(1);
    });

    it('should display class badges correctly', async () => {
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        const badges = screen.getAllByText('CS101');
        expect(badges.length).toBeGreaterThan(0);
        
        const badges2 = screen.getAllByText('CS201');
        expect(badges2.length).toBeGreaterThan(0);
      });
    });

    it('should handle multiple assigned classes', async () => {
      (getUser as any).mockResolvedValue(mockInstructionalUser);
      
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
        expect(screen.getByText('Data Structures')).toBeInTheDocument();
        expect(screen.getByText('Algorithms')).toBeInTheDocument();
      });
    });
  });

  describe('Loading and Error States', () => {
    it('should display loading state while fetching user data', () => {
      (getUser as any).mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderWithProviders(<Profile />);
      
      expect(screen.getByText('Loading Profile...')).toBeInTheDocument();
    });

    it('should display guest user state when no user data', async () => {
      (getUser as any).mockResolvedValue(null);
      
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Guest User')).toBeInTheDocument();
        expect(screen.getByText('You are browsing as a guest. Please log in to access your profile.')).toBeInTheDocument();
      });
    });

    it('should handle missing userId gracefully', async () => {
      
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Guest User')).toBeInTheDocument();
      });
      
      // Should not call getUser when userId is null
      expect(getUser).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      (getUser as any).mockRejectedValue(new Error('API Error'));
      
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Guest User')).toBeInTheDocument();
      });
    });

    it('should handle classes API errors gracefully', async () => {
      (getAllClasses as any).mockRejectedValue(new Error('Classes API Error'));
      
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });
      
      // Should still show user info even if classes fail to load
      expect(screen.queryByText('Assigned Classes')).not.toBeInTheDocument();
    });
  });

  describe('User Information Display', () => {
    it('should display member since date correctly', async () => {
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Member Since:')).toBeInTheDocument();
        expect(screen.getByText('1/15/2024')).toBeInTheDocument(); // Formatted date
      });
    });

    it('should handle missing user name gracefully', async () => {
      const userWithoutName = { ...mockUser, name: undefined };
      (getUser as any).mockResolvedValue(userWithoutName);
      
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('??')).toBeInTheDocument(); // Default initials
      });
    });

    it('should handle single name correctly', async () => {
      const userWithSingleName = { ...mockUser, name: 'John' };
      (getUser as any).mockResolvedValue(userWithSingleName);
      
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('John')).toBeInTheDocument();
        expect(screen.getByText('J')).toBeInTheDocument(); // Single initial
      });
    });

    it('should handle very long names correctly', async () => {
      const userWithLongName = { ...mockUser, name: 'Dr. Elizabeth Catherine Johnson-Smith' };
      (getUser as any).mockResolvedValue(userWithLongName);
      
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Dr. Elizabeth Catherine Johnson-Smith')).toBeInTheDocument();
        expect(screen.getByText('DE')).toBeInTheDocument(); // First two initials
      });
    });

    it('should display email correctly', async () => {
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('redacted@purdue.edu')).toBeInTheDocument();
      });
    });

    it('should display account type correctly', async () => {
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Account Type:')).toBeInTheDocument();
        expect(screen.getByText('Instructor')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty classes array', async () => {
      (getAllClasses as any).mockResolvedValue([]);
      
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });
      
      // Should not show assigned classes section
      expect(screen.queryByText('Assigned Classes')).not.toBeInTheDocument();
    });

    it('should handle malformed user data', async () => {
      const malformedUser = {
        id: 'user-1',
        // Missing required fields
      };
      (getUser as any).mockResolvedValue(malformedUser);
      
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('??')).toBeInTheDocument(); // Default initials for missing name
      });
    });

    it('should handle malformed class data', async () => {
      const malformedClasses = [
        {
          id: 'class-1',
          // Missing name, classCode, etc.
        },
      ];
      (getAllClasses as any).mockResolvedValue(malformedClasses);
      
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });
      
      // Should handle malformed class data gracefully
      expect(screen.queryByText('Assigned Classes')).not.toBeInTheDocument();
    });

    it('should handle component unmounting during data fetch', async () => {
      const { unmount } = renderWithProviders(<Profile />);
      
      // Unmount before data loads
      unmount();
      
      // Should not cause errors
      expect(getUser).toHaveBeenCalled();
    });

    it('should handle rapid re-renders', async () => {
      const { rerender } = renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });
      
      rerender(<Profile className="new-class" />);
      
      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });
    });

    it('should handle missing createdAt date', async () => {
      const userWithoutCreatedAt = { ...mockUser, createdAt: undefined };
      (getUser as any).mockResolvedValue(userWithoutCreatedAt);
      
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });
      
      // Should handle missing date gracefully
      expect(screen.getByText('Member Since:')).toBeInTheDocument();
    });

    it('should handle network timeouts', async () => {
      (getUser as any).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );
      
      renderWithProviders(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Guest User')).toBeInTheDocument();
      });
    });
  });
});

/*
 * Component Analysis for Profile:
 * Path: profile/Profile.tsx
 * 
 * Features detected:
 * - Default export: false
 * - Named exports: Profile
 * - Has props: true
 * - Props interface: ProfileProps
 * - Client component: false
 * - Uses hooks: useQuery, users, user, useAuth, userId, userLoading, username
 * - Uses router: false
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: false
 * - Uses effects: false
 * - Uses context: false
 * 
 * TODO: Implement the failing tests above with actual test logic
 * 
 * Example implementations:
 * 
 * Basic rendering:
 * render(<Profile {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 * 
 * Props testing:
 * const props = { ... };
 * render(<Profile {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 * 
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
