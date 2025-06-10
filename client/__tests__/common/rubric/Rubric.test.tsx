import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ReactNode } from 'react';
import Rubric from '@/components/common/rubric/Rubric';

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
vi.mock('@/utils/queries/rubrics/get-rubric', () => ({
  getRubric: vi.fn(),
}));

vi.mock('@/utils/queries/standard_groups/get-standard-groups-by-rubric', () => ({
  getStandardGroupsByRubric: vi.fn(),
}));

vi.mock('@/utils/queries/standards/get-standards-by-standardgroups', () => ({
  getStandardsByStandardGroups: vi.fn(),
}));

vi.mock('@/utils/mutations/rubrics/create-rubric', () => ({
  createRubric: vi.fn(),
}));

vi.mock('@/utils/mutations/rubrics/update-rubric', () => ({
  updateRubric: vi.fn(),
}));

// Import mocked functions
import { getRubric } from '@/utils/queries/rubrics/get-rubric';
import { getStandardGroupsByRubric } from '@/utils/queries/standard_groups/get-standard-groups-by-rubric';
import { getStandardsByStandardGroups } from '@/utils/queries/standards/get-standards-by-standardgroups';
import { createRubric } from '@/utils/mutations/rubrics/create-rubric';
import { updateRubric } from '@/utils/mutations/rubrics/update-rubric';

const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

// Mock data
const mockRubric = {
  id: 'rubric-1',
  name: 'Teaching Assistant Evaluation Rubric',
  description: 'A comprehensive rubric for evaluating TA performance',
  points: 100,
  passPoints: 70,
  createdAt: '2024-01-15T10:00:00Z',
};

const mockStandardGroups = [
  {
    id: 'group-1',
    name: 'Facilitates student-driven learning',
    description: 'Ability to guide students to discover solutions independently',
    rubricId: 'rubric-1',
  },
  {
    id: 'group-2',
    name: 'Demonstrates understanding of course objectives',
    description: 'Shows clear knowledge of course goals and learning outcomes',
    rubricId: 'rubric-1',
  },
];

const mockStandards = [
  {
    id: 'standard-1',
    name: 'Excellent (5)',
    description: 'Consistently guides students to discover solutions independently',
    standardGroupId: 'group-1',
  },
  {
    id: 'standard-2',
    name: 'Good (4)',
    description: 'Usually guides students to discover solutions independently',
    standardGroupId: 'group-1',
  },
  {
    id: 'standard-3',
    name: 'Excellent (5)',
    description: 'Demonstrates comprehensive understanding of course objectives',
    standardGroupId: 'group-2',
  },
];

describe('Rubric', () => {
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
    (getRubric as any).mockResolvedValue(mockRubric);
    (getStandardGroupsByRubric as any).mockResolvedValue(mockStandardGroups);
    (getStandardsByStandardGroups as any).mockResolvedValue(mockStandards);
    (createRubric as any).mockResolvedValue({ id: 'new-rubric-id' });
    (updateRubric as any).mockResolvedValue(undefined);
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
    it('should render without crashing', () => {
      renderWithProviders(<Rubric />);
      
      expect(screen.getByText('Create Rubric')).toBeInTheDocument();
    });

    it('should render in create mode by default', () => {
      renderWithProviders(<Rubric />);
      
      expect(screen.getByText('Create Rubric')).toBeInTheDocument();
      expect(screen.getByText('Create a new evaluation rubric with scoring criteria')).toBeInTheDocument();
    });

    it('should render in edit mode when rubricId is provided', async () => {
      renderWithProviders(<Rubric rubricId="rubric-1" mode="edit" />);
      
      await waitFor(() => {
        expect(screen.getByText('Edit Rubric')).toBeInTheDocument();
      });
    });

    it('should render with showAdvancedFeatures enabled', async () => {
      renderWithProviders(<Rubric rubricId="rubric-1" mode="edit" showAdvancedFeatures={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Teaching Assistant Evaluation Rubric')).toBeInTheDocument();
      });
    });

    it('should render basic form when showAdvancedFeatures is disabled', () => {
      renderWithProviders(<Rubric showAdvancedFeatures={false} />);
      
      expect(screen.getByText('Create Rubric')).toBeInTheDocument();
      expect(screen.getByLabelText(/rubric name/i)).toBeInTheDocument();
    });

    it('should have correct accessibility attributes', () => {
      renderWithProviders(<Rubric />);
      
      const nameInput = screen.getByLabelText(/rubric name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      const pointsInput = screen.getByLabelText(/total points/i);
      const passPointsInput = screen.getByLabelText(/pass points/i);
      
      expect(nameInput).toBeInTheDocument();
      expect(descriptionInput).toBeInTheDocument();
      expect(pointsInput).toBeInTheDocument();
      expect(passPointsInput).toBeInTheDocument();
    });
  });

  describe('Form Handling', () => {
    it('should handle form input changes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Rubric />);
      
      const nameInput = screen.getByLabelText(/rubric name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      
      await user.type(nameInput, 'Test Rubric');
      await user.type(descriptionInput, 'Test description');
      
      expect(nameInput).toHaveValue('Test Rubric');
      expect(descriptionInput).toHaveValue('Test description');
    });

    it('should handle numeric input changes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Rubric />);
      
      const pointsInput = screen.getByLabelText(/total points/i);
      const passPointsInput = screen.getByLabelText(/pass points/i);
      
      await user.clear(pointsInput);
      await user.type(pointsInput, '80');
      await user.clear(passPointsInput);
      await user.type(passPointsInput, '56');
      
      expect(pointsInput).toHaveValue(80);
      expect(passPointsInput).toHaveValue(56);
    });

    it('should validate required fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Rubric />);
      
      const submitButton = screen.getByRole('button', { name: /create rubric/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Rubric name is required');
      });
    });

    it('should validate points constraints', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Rubric />);
      
      const nameInput = screen.getByLabelText(/rubric name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      const pointsInput = screen.getByLabelText(/total points/i);
      
      await user.type(nameInput, 'Test Rubric');
      await user.type(descriptionInput, 'Test description');
      await user.clear(pointsInput);
      await user.type(pointsInput, '0');
      
      const submitButton = screen.getByRole('button', { name: /create rubric/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Total points must be greater than 0');
      });
    });

    it('should validate pass points constraints', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Rubric />);
      
      const nameInput = screen.getByLabelText(/rubric name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      const pointsInput = screen.getByLabelText(/total points/i);
      const passPointsInput = screen.getByLabelText(/pass points/i);
      
      await user.type(nameInput, 'Test Rubric');
      await user.type(descriptionInput, 'Test description');
      await user.clear(pointsInput);
      await user.type(pointsInput, '100');
      await user.clear(passPointsInput);
      await user.type(passPointsInput, '150');
      
      const submitButton = screen.getByRole('button', { name: /create rubric/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Pass points must be between 0 and total points');
      });
    });

    it('should handle successful form submission for create mode', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Rubric />);
      
      const nameInput = screen.getByLabelText(/rubric name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      
      await user.type(nameInput, 'Test Rubric');
      await user.type(descriptionInput, 'Test description');
      
      const submitButton = screen.getByRole('button', { name: /create rubric/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(createRubric).toHaveBeenCalledWith({
          name: 'Test Rubric',
          description: 'Test description',
          points: 100,
          passPoints: 70,
        });
      });
    });
  });

  describe('Edit Mode', () => {
    it('should load existing rubric data in edit mode', async () => {
      renderWithProviders(<Rubric rubricId="rubric-1" mode="edit" />);
      
      await waitFor(() => {
        expect(getRubric).toHaveBeenCalledWith('rubric-1');
      });
    });

    it('should populate form fields with existing data', async () => {
      renderWithProviders(<Rubric rubricId="rubric-1" mode="edit" showAdvancedFeatures={false} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Teaching Assistant Evaluation Rubric')).toBeInTheDocument();
        expect(screen.getByDisplayValue('A comprehensive rubric for evaluating TA performance')).toBeInTheDocument();
        expect(screen.getByDisplayValue('100')).toBeInTheDocument();
        expect(screen.getByDisplayValue('70')).toBeInTheDocument();
      });
    });

    it('should handle rubric not found error', async () => {
      (getRubric as any).mockResolvedValue(null);
      
      renderWithProviders(<Rubric rubricId="nonexistent" mode="edit" />);
      
      await waitFor(() => {
        expect(screen.getByText('Rubric Not Found')).toBeInTheDocument();
        expect(screen.getByText("The rubric you're looking for doesn't exist.")).toBeInTheDocument();
      });
    });

    it('should handle update submission', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Rubric rubricId="rubric-1" mode="edit" showAdvancedFeatures={false} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Teaching Assistant Evaluation Rubric')).toBeInTheDocument();
      });
      
      const nameInput = screen.getByDisplayValue('Teaching Assistant Evaluation Rubric');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Rubric Name');
      
      const submitButton = screen.getByRole('button', { name: /update rubric/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(updateRubric).toHaveBeenCalled();
      });
    });
  });

  describe('Advanced Features', () => {
    it('should display standard groups when advanced features are enabled', async () => {
      renderWithProviders(<Rubric rubricId="rubric-1" mode="edit" showAdvancedFeatures={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Facilitates student-driven learning')).toBeInTheDocument();
        expect(screen.getByText('Demonstrates understanding of course objectives')).toBeInTheDocument();
      });
    });

    it('should handle collapsible standard groups', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Rubric rubricId="rubric-1" mode="edit" showAdvancedFeatures={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Facilitates student-driven learning')).toBeInTheDocument();
      });
      
      // Click to expand/collapse
      const groupHeader = screen.getByText('Facilitates student-driven learning').closest('div');
      if (groupHeader) {
        await user.click(groupHeader);
      }
    });

    it('should display standards table when expanded', async () => {
      renderWithProviders(<Rubric rubricId="rubric-1" mode="edit" showAdvancedFeatures={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Rating')).toBeInTheDocument();
        expect(screen.getByText('Level')).toBeInTheDocument();
        expect(screen.getByText('Description')).toBeInTheDocument();
        expect(screen.getByText('Actions')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should handle cancel button click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Rubric />);
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      expect(mockPush).toHaveBeenCalledWith('/create/rubrics');
    });

    it('should navigate back from not found page', async () => {
      const user = userEvent.setup();
      (getRubric as any).mockResolvedValue(null);
      
      renderWithProviders(<Rubric rubricId="nonexistent" mode="edit" />);
      
      await waitFor(() => {
        expect(screen.getByText('Back to Rubrics')).toBeInTheDocument();
      });
      
      const backButton = screen.getByText('Back to Rubrics');
      await user.click(backButton);
      
      expect(mockPush).toHaveBeenCalledWith('/create/rubrics');
    });
  });

  describe('Loading States', () => {
    it('should show loading state while fetching rubric data', () => {
      (getRubric as any).mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderWithProviders(<Rubric rubricId="rubric-1" mode="edit" />);
      
      // Should show loading spinner
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('should handle loading states for standard groups', () => {
      (getStandardGroupsByRubric as any).mockImplementation(() => new Promise(() => {}));
      
      renderWithProviders(<Rubric rubricId="rubric-1" mode="edit" showAdvancedFeatures={true} />);
      
      // Should show loading state
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('API Integration', () => {
    it('should fetch rubric data when in edit mode', async () => {
      renderWithProviders(<Rubric rubricId="rubric-1" mode="edit" />);
      
      await waitFor(() => {
        expect(getRubric).toHaveBeenCalledWith('rubric-1');
      });
    });

    it('should fetch standard groups when advanced features are enabled', async () => {
      renderWithProviders(<Rubric rubricId="rubric-1" mode="edit" showAdvancedFeatures={true} />);
      
      await waitFor(() => {
        expect(getStandardGroupsByRubric).toHaveBeenCalledWith('rubric-1');
      });
    });

    it('should fetch standards when standard groups are available', async () => {
      renderWithProviders(<Rubric rubricId="rubric-1" mode="edit" showAdvancedFeatures={true} />);
      
      await waitFor(() => {
        expect(getStandardsByStandardGroups).toHaveBeenCalledWith(['group-1', 'group-2']);
      });
    });

    it('should handle API errors gracefully', async () => {
      (getRubric as any).mockRejectedValue(new Error('API Error'));
      
      renderWithProviders(<Rubric rubricId="rubric-1" mode="edit" />);
      
      // Should not crash on API error
      await waitFor(() => {
        expect(getRubric).toHaveBeenCalledWith('rubric-1');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty standard groups', async () => {
      (getStandardGroupsByRubric as any).mockResolvedValue([]);
      
      renderWithProviders(<Rubric rubricId="rubric-1" mode="edit" showAdvancedFeatures={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Teaching Assistant Evaluation Rubric')).toBeInTheDocument();
      });
    });

    it('should handle empty standards', async () => {
      (getStandardsByStandardGroups as any).mockResolvedValue([]);
      
      renderWithProviders(<Rubric rubricId="rubric-1" mode="edit" showAdvancedFeatures={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Facilitates student-driven learning')).toBeInTheDocument();
      });
    });

    it('should handle missing rubricId in edit mode', () => {
      renderWithProviders(<Rubric rubricId="" mode="edit" />);
      
      // Should not make API call with empty ID
      expect(getRubric).not.toHaveBeenCalledWith('');
    });

    it('should handle component unmounting during API calls', async () => {
      const { unmount } = renderWithProviders(<Rubric rubricId="rubric-1" mode="edit" />);
      
      unmount();
      
      // Should not cause errors
      expect(getRubric).toHaveBeenCalled();
    });

    it('should display current configuration preview', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Rubric />);
      
      const pointsInput = screen.getByLabelText(/total points/i);
      const passPointsInput = screen.getByLabelText(/pass points/i);
      
      await user.clear(pointsInput);
      await user.type(pointsInput, '80');
      await user.clear(passPointsInput);
      await user.type(passPointsInput, '56');
      
      await waitFor(() => {
        expect(screen.getByText('Total: 80 points')).toBeInTheDocument();
        expect(screen.getByText('Pass: 56 points (70%)')).toBeInTheDocument();
      });
    });

    it('should handle form submission errors', async () => {
      const user = userEvent.setup();
      (createRubric as any).mockRejectedValue(new Error('Creation failed'));
      
      renderWithProviders(<Rubric />);
      
      const nameInput = screen.getByLabelText(/rubric name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      
      await user.type(nameInput, 'Test Rubric');
      await user.type(descriptionInput, 'Test description');
      
      const submitButton = screen.getByRole('button', { name: /create rubric/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(createRubric).toHaveBeenCalled();
      });
    });

    it('should handle rapid form interactions', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Rubric />);
      
      const nameInput = screen.getByLabelText(/rubric name/i);
      
      // Rapid typing and clearing
      await user.type(nameInput, 'Test');
      await user.clear(nameInput);
      await user.type(nameInput, 'Final Name');
      
      expect(nameInput).toHaveValue('Final Name');
    });
  });
});

/*
 * Component Analysis for Rubric:
 * Path: common/rubric/Rubric.tsx
 * 
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true
 * - Props interface: RubricProps
 * - Client component: true
 * - Uses hooks: useState, useEffect, useRouter, useQuery, useMutation, useQueryClient
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
 * render(<Rubric {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 * 
 * Props testing:
 * const props = { ... };
 * render(<Rubric {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 * 
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
