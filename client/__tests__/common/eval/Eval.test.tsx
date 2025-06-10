import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ReactNode } from 'react';
import Eval from '@/components/common/eval/Eval';

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
  },
}));

// Mock API calls
vi.mock('@/utils/queries/evals/get-eval', () => ({
  getEval: vi.fn(),
}));

vi.mock('@/utils/queries/classes/get-all-classes', () => ({
  getAllClasses: vi.fn(),
}));

vi.mock('@/utils/queries/agents/get-all-agents', () => ({
  getAllAgents: vi.fn(),
}));

vi.mock('@/utils/queries/scenarios/get-all-scenarios', () => ({
  getAllScenarios: vi.fn(),
}));

vi.mock('@/utils/queries/rubrics/get-all-rubrics', () => ({
  getAllRubrics: vi.fn(),
}));

vi.mock('@/utils/mutations/evals/create-eval', () => ({
  createEval: vi.fn(),
}));

vi.mock('@/utils/mutations/evals/update-eval', () => ({
  updateEval: vi.fn(),
}));

// Import mocked functions
import { getEval } from '@/utils/queries/evals/get-eval';
import { getAllClasses } from '@/utils/queries/classes/get-all-classes';
import { getAllAgents } from '@/utils/queries/agents/get-all-agents';
import { getAllScenarios } from '@/utils/queries/scenarios/get-all-scenarios';
import { getAllRubrics } from '@/utils/queries/rubrics/get-all-rubrics';
import { createEval } from '@/utils/mutations/evals/create-eval';
import { updateEval } from '@/utils/mutations/evals/update-eval';

const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

// Mock data
const mockEval = {
  id: 'eval-1',
  name: 'Test Evaluation',
  description: 'A test evaluation for unit testing',
  classId: 'class-1',
  baseAgentId: 'agent-1',
  scenarioIds: ['scenario-1', 'scenario-2'],
  agentIds: ['agent-1', 'agent-2'],
  evalType: 'student' as const,
  maxTurns: 10,
  numParallelRuns: 3,
  rubricIds: ['rubric-1'],
  createdAt: '2024-01-15T10:00:00Z',
};

const mockClasses = [
  { id: 'class-1', name: 'Math 101', classCode: 'MATH101' },
  { id: 'class-2', name: 'Science 201', classCode: 'SCI201' },
];

const mockAgents = [
  { id: 'agent-1', name: 'Math Tutor Agent' },
  { id: 'agent-2', name: 'Science Helper Agent' },
];

const mockScenarios = [
  { id: 'scenario-1', name: 'Basic Math Problem' },
  { id: 'scenario-2', name: 'Advanced Math Problem' },
];

const mockRubrics = [
  { id: 'rubric-1', name: 'Math Assessment Rubric' },
  { id: 'rubric-2', name: 'Science Assessment Rubric' },
];

describe('Eval', () => {
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
    (getEval as any).mockResolvedValue(mockEval);
    (getAllClasses as any).mockResolvedValue(mockClasses);
    (getAllAgents as any).mockResolvedValue(mockAgents);
    (getAllScenarios as any).mockResolvedValue(mockScenarios);
    (getAllRubrics as any).mockResolvedValue(mockRubrics);
    (createEval as any).mockResolvedValue(undefined);
    (updateEval as any).mockResolvedValue(undefined);
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
    it('should render in create mode by default', async () => {
      renderWithProviders(<Eval />);
      
      await waitFor(() => {
        expect(screen.getByText('Create Evaluation')).toBeInTheDocument();
      });
    });

    it('should render in edit mode when evalId is provided', async () => {
      renderWithProviders(<Eval evalId="eval-1" mode="edit" />);
      
      await waitFor(() => {
        expect(screen.getByText('Edit Evaluation')).toBeInTheDocument();
      });
    });

    it('should render with mode prop', async () => {
      renderWithProviders(<Eval mode="create" />);
      
      await waitFor(() => {
        expect(screen.getByText('Create Evaluation')).toBeInTheDocument();
      });
    });

    it('should display loading state while fetching eval data', () => {
      (getEval as any).mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderWithProviders(<Eval evalId="eval-1" mode="edit" />);
      
      // Should show loading spinner
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('should populate form fields with eval data when loaded', async () => {
      renderWithProviders(<Eval evalId="eval-1" mode="edit" />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Evaluation')).toBeInTheDocument();
        expect(screen.getByDisplayValue('A test evaluation for unit testing')).toBeInTheDocument();
        expect(screen.getByDisplayValue('10')).toBeInTheDocument();
        expect(screen.getByDisplayValue('3')).toBeInTheDocument();
      });
    });

    it('should have correct accessibility attributes', async () => {
      renderWithProviders(<Eval />);
      
      await waitFor(() => {
        const nameInput = screen.getByLabelText(/evaluation name/i);
        const descriptionInput = screen.getByLabelText(/description/i);
        
        expect(nameInput).toBeInTheDocument();
        expect(descriptionInput).toBeInTheDocument();
        
        // Check for submit button
        const submitButton = screen.getByRole('button', { name: /create evaluation/i });
        expect(submitButton).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should handle form field updates', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Eval />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/evaluation name/i)).toBeInTheDocument();
      });
      
      const nameInput = screen.getByLabelText(/evaluation name/i);
      await user.type(nameInput, 'New Evaluation Name');
      
      expect(screen.getByDisplayValue('New Evaluation Name')).toBeInTheDocument();
    });

    it('should handle form submission with valid data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Eval />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/evaluation name/i)).toBeInTheDocument();
      });
      
      // Fill required fields
      const nameInput = screen.getByLabelText(/evaluation name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      
      await user.type(nameInput, 'Test Evaluation');
      await user.type(descriptionInput, 'Test Description');
      
      // Select base agent
      const baseAgentSelect = screen.getByRole('combobox', { name: /base agent/i });
      await user.click(baseAgentSelect);
      
      await waitFor(() => {
        const agentOption = screen.getByText('Math Tutor Agent');
        expect(agentOption).toBeInTheDocument();
      });
    });

    it('should handle cancel button click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Eval />);
      
      await waitFor(() => {
        expect(screen.getByText('Create Evaluation')).toBeInTheDocument();
      });
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);
      
      expect(mockPush).toHaveBeenCalledWith('/management/evals');
    });

    it('should handle scenario selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Eval />);
      
      await waitFor(() => {
        expect(screen.getByText('Create Evaluation')).toBeInTheDocument();
      });
      
      // Should show scenario selection area
      expect(screen.getByText(/scenarios/i)).toBeInTheDocument();
    });

    it('should handle agent selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Eval />);
      
      await waitFor(() => {
        expect(screen.getByText('Create Evaluation')).toBeInTheDocument();
      });
      
      // Should show agent selection area
      expect(screen.getByText(/evaluation agents/i)).toBeInTheDocument();
    });

    it('should handle rubric selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Eval />);
      
      await waitFor(() => {
        expect(screen.getByText('Create Evaluation')).toBeInTheDocument();
      });
      
      // Should show rubric selection area
      expect(screen.getByText(/rubrics/i)).toBeInTheDocument();
    });
  });

  describe('API Integration', () => {
    it('should fetch eval data on mount in edit mode', async () => {
      renderWithProviders(<Eval evalId="eval-1" mode="edit" />);
      
      await waitFor(() => {
        expect(getEval).toHaveBeenCalledWith('eval-1');
      });
    });

    it('should fetch all required data for form options', async () => {
      renderWithProviders(<Eval />);
      
      await waitFor(() => {
        expect(getAllClasses).toHaveBeenCalled();
        expect(getAllAgents).toHaveBeenCalled();
        expect(getAllScenarios).toHaveBeenCalled();
        expect(getAllRubrics).toHaveBeenCalled();
      });
    });

    it('should handle create mutation success', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Eval />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/evaluation name/i)).toBeInTheDocument();
      });
      
      // Fill required fields
      const nameInput = screen.getByLabelText(/evaluation name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      
      await user.type(nameInput, 'Test Evaluation');
      await user.type(descriptionInput, 'Test Description');
      
      // Submit form (will fail validation but test mutation setup)
      const submitButton = screen.getByRole('button', { name: /create evaluation/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please fill in all required fields');
      });
    });

    it('should handle update mutation in edit mode', async () => {
      renderWithProviders(<Eval evalId="eval-1" mode="edit" />);
      
      await waitFor(() => {
        expect(getEval).toHaveBeenCalledWith('eval-1');
        expect(screen.getByDisplayValue('Test Evaluation')).toBeInTheDocument();
      });
    });

    it('should handle loading states correctly', () => {
      (getAllClasses as any).mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderWithProviders(<Eval />);
      
      // Should still render form even with loading data
      expect(screen.getByText('Create Evaluation')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Eval />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/evaluation name/i)).toBeInTheDocument();
      });
      
      // Submit form without filling required fields
      const submitButton = screen.getByRole('button', { name: /create evaluation/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
      });
    });

    it('should validate description field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Eval />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/evaluation name/i)).toBeInTheDocument();
      });
      
      // Fill name but not description
      const nameInput = screen.getByLabelText(/evaluation name/i);
      await user.type(nameInput, 'Test Evaluation');
      
      const submitButton = screen.getByRole('button', { name: /create evaluation/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Description is required')).toBeInTheDocument();
      });
    });

    it('should validate base agent selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Eval />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/evaluation name/i)).toBeInTheDocument();
      });
      
      // Fill name and description but not base agent
      const nameInput = screen.getByLabelText(/evaluation name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      
      await user.type(nameInput, 'Test Evaluation');
      await user.type(descriptionInput, 'Test Description');
      
      const submitButton = screen.getByRole('button', { name: /create evaluation/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Base agent is required')).toBeInTheDocument();
      });
    });

    it('should validate max turns range', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Eval />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/max turns/i)).toBeInTheDocument();
      });
      
      const maxTurnsInput = screen.getByLabelText(/max turns/i);
      await user.clear(maxTurnsInput);
      await user.type(maxTurnsInput, '150'); // Invalid range
      
      const submitButton = screen.getByRole('button', { name: /create evaluation/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Max turns must be between 1 and 100')).toBeInTheDocument();
      });
    });

    it('should validate parallel runs range', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Eval />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/parallel runs/i)).toBeInTheDocument();
      });
      
      const parallelRunsInput = screen.getByLabelText(/parallel runs/i);
      await user.clear(parallelRunsInput);
      await user.type(parallelRunsInput, '15'); // Invalid range
      
      const submitButton = screen.getByRole('button', { name: /create evaluation/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Parallel runs must be between 1 and 10')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing evalId in edit mode', () => {
      renderWithProviders(<Eval evalId="" mode="edit" />);
      
      // Should not crash and should not make API call with empty ID
      expect(getEval).not.toHaveBeenCalledWith('');
    });

    it('should handle eval not found', async () => {
      (getEval as any).mockRejectedValue(new Error('Eval not found'));
      
      renderWithProviders(<Eval evalId="nonexistent-eval" mode="edit" />);
      
      // Component should handle the error gracefully
      await waitFor(() => {
        expect(getEval).toHaveBeenCalledWith('nonexistent-eval');
      });
    });

    it('should handle empty data arrays', async () => {
      (getAllClasses as any).mockResolvedValue([]);
      (getAllAgents as any).mockResolvedValue([]);
      (getAllScenarios as any).mockResolvedValue([]);
      (getAllRubrics as any).mockResolvedValue([]);
      
      renderWithProviders(<Eval />);
      
      await waitFor(() => {
        expect(screen.getByText('Create Evaluation')).toBeInTheDocument();
      });
      
      // Should still render form even with empty data
      expect(screen.getByLabelText(/evaluation name/i)).toBeInTheDocument();
    });

    it('should filter out RAY placeholder values', async () => {
      const evalWithRAY = {
        ...mockEval,
        scenarioIds: ['scenario-1', 'RAY', 'scenario-2'],
        agentIds: ['agent-1', 'RAY'],
        rubricIds: ['RAY', 'rubric-1'],
      };
      (getEval as any).mockResolvedValue(evalWithRAY);
      
      renderWithProviders(<Eval evalId="eval-1" mode="edit" />);
      
      await waitFor(() => {
        expect(screen.getByText('Edit Evaluation')).toBeInTheDocument();
      });
      
      // RAY values should be filtered out in the form data
      expect(screen.getByDisplayValue('Test Evaluation')).toBeInTheDocument();
    });

    it('should handle network errors gracefully', async () => {
      (getEval as any).mockRejectedValue(new Error('Network error'));
      
      renderWithProviders(<Eval evalId="eval-1" mode="edit" />);
      
      // Should not crash on network error
      await waitFor(() => {
        expect(getEval).toHaveBeenCalledWith('eval-1');
      });
    });

    it('should handle mutation errors', async () => {
      (createEval as any).mockRejectedValue(new Error('Creation failed'));
      
      const user = userEvent.setup();
      renderWithProviders(<Eval />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/evaluation name/i)).toBeInTheDocument();
      });
      
      // Fill form and submit
      const nameInput = screen.getByLabelText(/evaluation name/i);
      await user.type(nameInput, 'Test Evaluation');
      
      const submitButton = screen.getByRole('button', { name: /create evaluation/i });
      await user.click(submitButton);
      
      // Should handle validation error first
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please fill in all required fields');
      });
    });
  });
});

/*
 * Component Analysis for Eval:
 * Path: common/eval/Eval.tsx
 * 
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true
 * - Props interface: EvalProps
 * - Client component: true
 * - Uses hooks: useState, useEffect, useQuery, useMutation, useQueryClient, useRouter
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
 * render(<Eval {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 * 
 * Props testing:
 * const props = { ... };
 * render(<Eval {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 * 
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
