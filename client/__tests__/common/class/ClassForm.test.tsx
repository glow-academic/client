import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { toast } from 'sonner';
import ClassForm from '@/components/common/class/ClassForm';

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

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Mock API calls
vi.mock('@/utils/queries/documents/get-all-documents', () => ({
  getAllDocuments: vi.fn(),
}));

vi.mock('@/utils/mutations/classes/create-class', () => ({
  createClass: vi.fn(),
}));

vi.mock('@/utils/mutations/classes/update-class', () => ({
  updateClass: vi.fn(),
}));

// Import mocked functions
import { getAllDocuments } from '@/utils/queries/documents/get-all-documents';
import { createClass } from '@/utils/mutations/classes/create-class';
import { updateClass } from '@/utils/mutations/classes/update-class';

const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

// Mock data
const mockClass = {
  id: 'class-1',
  name: 'Mathematics 101',
  classCode: 'MATH101',
  year: 2024,
  term: 'fall' as const,
  description: 'Introduction to Mathematics',
};

const mockDocuments = [
  {
    id: 'doc-1',
    filename: 'syllabus.pdf',
    type: 'syllabus',
    classId: 'class-1',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'doc-2',
    filename: 'lecture1.pdf',
    type: 'lecture',
    classId: 'class-1',
    createdAt: '2024-01-16T10:00:00Z',
  },
];

describe('ClassForm', () => {
  let queryClient: QueryClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    (useRouter as any).mockReturnValue(mockRouter);
    (getAllDocuments as any).mockResolvedValue(mockDocuments);
    (createClass as any).mockResolvedValue({ id: 'new-class-id' });
    (updateClass as any).mockResolvedValue(undefined);
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
    it('should render without crashing in create mode', () => {
      renderWithProviders(<ClassForm mode="create" />);
      
      expect(screen.getByText('Create Class')).toBeInTheDocument();
      expect(screen.getByLabelText(/class name/i)).toBeInTheDocument();
    });

    it('should render without crashing in edit mode', () => {
      renderWithProviders(
        <ClassForm 
          mode="edit" 
          classId="class-1" 
          initialData={mockClass} 
        />
      );
      
      expect(screen.getByText('Edit Class')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Mathematics 101')).toBeInTheDocument();
    });

    it('should render with required mode prop', () => {
      renderWithProviders(<ClassForm mode="create" />);
      
      expect(screen.getByRole('button', { name: /create class/i })).toBeInTheDocument();
    });

    it('should populate form fields with initial data', () => {
      renderWithProviders(
        <ClassForm 
          mode="edit" 
          classId="class-1" 
          initialData={mockClass} 
        />
      );
      
      expect(screen.getByDisplayValue('Mathematics 101')).toBeInTheDocument();
      expect(screen.getByDisplayValue('MATH101')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2024')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Introduction to Mathematics')).toBeInTheDocument();
    });

    it('should have correct accessibility attributes', () => {
      renderWithProviders(<ClassForm mode="create" />);
      
      const nameInput = screen.getByLabelText(/class name/i);
      const codeInput = screen.getByLabelText(/class code/i);
      const yearInput = screen.getByLabelText(/year/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      
      expect(nameInput).toBeInTheDocument();
      expect(codeInput).toBeInTheDocument();
      expect(yearInput).toBeInTheDocument();
      expect(descriptionInput).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should handle form field updates', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClassForm mode="create" />);
      
      const nameInput = screen.getByLabelText(/class name/i);
      await user.type(nameInput, 'New Class Name');
      
      expect(screen.getByDisplayValue('New Class Name')).toBeInTheDocument();
    });

    it('should handle form submission in create mode', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      
      renderWithProviders(
        <ClassForm mode="create" onSuccess={onSuccess} />
      );
      
      // Fill out form
      await user.type(screen.getByLabelText(/class name/i), 'Test Class');
      await user.type(screen.getByLabelText(/class code/i), 'TEST101');
      await user.type(screen.getByLabelText(/description/i), 'Test description');
      
      const submitButton = screen.getByRole('button', { name: /create class/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(createClass).toHaveBeenCalledWith({
          name: 'Test Class',
          classCode: 'TEST101',
          year: new Date().getFullYear(),
          term: 'fall',
          description: 'Test description',
        });
      });
    });

    it('should handle form submission in edit mode', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      
      renderWithProviders(
        <ClassForm 
          mode="edit" 
          classId="class-1" 
          initialData={mockClass}
          onSuccess={onSuccess} 
        />
      );
      
      // Update a field
      const nameInput = screen.getByDisplayValue('Mathematics 101');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Math Class');
      
      const submitButton = screen.getByRole('button', { name: /update class/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(updateClass).toHaveBeenCalledWith('class-1', {
          name: 'Updated Math Class',
          classCode: 'MATH101',
          year: 2024,
          term: 'fall',
          description: 'Introduction to Mathematics',
        });
      });
    });

    it('should handle term selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClassForm mode="create" />);
      
      const termSelect = screen.getByRole('combobox');
      await user.click(termSelect);
      
      const springOption = screen.getByRole('option', { name: /spring/i });
      await user.click(springOption);
      
      expect(screen.getByText('Spring')).toBeInTheDocument();
    });

    it('should handle cancel button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClassForm mode="create" />);
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      expect(mockPush).toHaveBeenCalledWith('/classes');
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClassForm mode="create" />);
      
      const submitButton = screen.getByRole('button', { name: /create class/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Class name is required')).toBeInTheDocument();
        expect(screen.getByText('Class code is required')).toBeInTheDocument();
      });
    });

    it('should validate class code format', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClassForm mode="create" />);
      
      await user.type(screen.getByLabelText(/class name/i), 'Test Class');
      await user.type(screen.getByLabelText(/class code/i), 'invalid code');
      
      const submitButton = screen.getByRole('button', { name: /create class/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/class code must be alphanumeric/i)).toBeInTheDocument();
      });
    });

    it('should validate year range', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClassForm mode="create" />);
      
      await user.type(screen.getByLabelText(/class name/i), 'Test Class');
      await user.type(screen.getByLabelText(/class code/i), 'TEST101');
      
      const yearInput = screen.getByLabelText(/year/i);
      await user.clear(yearInput);
      await user.type(yearInput, '1900');
      
      const submitButton = screen.getByRole('button', { name: /create class/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/year must be between/i)).toBeInTheDocument();
      });
    });
  });

  describe('Document Management', () => {
    it('should display documents in edit mode', async () => {
      renderWithProviders(
        <ClassForm 
          mode="edit" 
          classId="class-1" 
          initialData={mockClass} 
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('syllabus.pdf')).toBeInTheDocument();
        expect(screen.getByText('lecture1.pdf')).toBeInTheDocument();
      });
    });

    it('should handle document search', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ClassForm 
          mode="edit" 
          classId="class-1" 
          initialData={mockClass} 
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('syllabus.pdf')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText(/search documents/i);
      await user.type(searchInput, 'syllabus');
      
      // Should filter documents
      expect(screen.getByText('syllabus.pdf')).toBeInTheDocument();
    });

    it('should handle view mode toggle', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ClassForm 
          mode="edit" 
          classId="class-1" 
          initialData={mockClass} 
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('syllabus.pdf')).toBeInTheDocument();
      });
      
      const gridViewButton = screen.getByRole('button', { name: /grid view/i });
      await user.click(gridViewButton);
      
      // Should switch to grid view
      expect(gridViewButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('API Integration', () => {
    it('should handle successful class creation', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      
      renderWithProviders(
        <ClassForm mode="create" onSuccess={onSuccess} />
      );
      
      await user.type(screen.getByLabelText(/class name/i), 'Test Class');
      await user.type(screen.getByLabelText(/class code/i), 'TEST101');
      
      const submitButton = screen.getByRole('button', { name: /create class/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Class created successfully!');
        expect(onSuccess).toHaveBeenCalledWith('new-class-id');
      });
    });

    it('should handle API errors', async () => {
      const user = userEvent.setup();
      (createClass as any).mockRejectedValue(new Error('API Error'));
      
      renderWithProviders(<ClassForm mode="create" />);
      
      await user.type(screen.getByLabelText(/class name/i), 'Test Class');
      await user.type(screen.getByLabelText(/class code/i), 'TEST101');
      
      const submitButton = screen.getByRole('button', { name: /create class/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create class: API Error');
      });
    });

    it('should handle loading states', async () => {
      const user = userEvent.setup();
      (createClass as any).mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderWithProviders(<ClassForm mode="create" />);
      
      await user.type(screen.getByLabelText(/class name/i), 'Test Class');
      await user.type(screen.getByLabelText(/class code/i), 'TEST101');
      
      const submitButton = screen.getByRole('button', { name: /create class/i });
      await user.click(submitButton);
      
      // Should show loading state
      expect(screen.getByRole('button', { name: /creating/i })).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing initial data gracefully', () => {
      renderWithProviders(
        <ClassForm mode="edit" classId="class-1" />
      );
      
      // Should render with empty form
      expect(screen.getByLabelText(/class name/i)).toHaveValue('');
    });

    it('should handle empty documents list', async () => {
      (getAllDocuments as any).mockResolvedValue([]);
      
      renderWithProviders(
        <ClassForm mode="edit" classId="class-1" initialData={mockClass} />
      );
      
      await waitFor(() => {
        expect(screen.getByText(/no documents found/i)).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      (getAllDocuments as any).mockRejectedValue(new Error('Network error'));
      
      renderWithProviders(
        <ClassForm mode="edit" classId="class-1" initialData={mockClass} />
      );
      
      // Should not crash on network error
      expect(screen.getByText('Edit Class')).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for ClassForm:
 * Path: common/class/ClassForm.tsx
 * 
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true
 * - Props interface: ClassFormProps
 * - Client component: true
 * - Uses hooks: useState, useRef, useCallback, useRouter, useQuery, useQueryClient, useEffect, uses
 * - Uses router: true
 * - Has API calls: true
 * - Has form handling: true
 * - Uses state: true
 * - Uses effects: true
 * - Uses context: false
 * 
 * TODO: Implement the failing tests above with actual test logic
 * 
 * Example implementations:
 * 
 * Basic rendering:
 * render(<ClassForm {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 * 
 * Props testing:
 * const props = { ... };
 * render(<ClassForm {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 * 
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
