import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import Eval from '@/components/common/eval/Eval';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the query functions
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

const mockPush = vi.fn();
const mockEval = {
  id: '1',
  name: 'Test Eval',
  description: 'Test Description',
  baseAgentId: 'agent-1',
  scenarioIds: ['scenario-1'],
  agentIds: ['agent-2'],
  evalType: 'student' as const,
  maxTurns: 10,
  maxParallelRuns: 1,
  rubricIds: ['rubric-1'],
};

const mockClasses = [
  { id: 'class-1', name: 'Test Class' },
];

const mockAgents = [
  { id: 'agent-1', name: 'Base Agent' },
  { id: 'agent-2', name: 'Test Agent' },
];

const mockScenarios = [
  { id: 'scenario-1', name: 'Test Scenario', description: 'Test scenario description' },
];

const mockRubrics = [
  { id: 'rubric-1', name: 'Test Rubric', points: 100, passPoints: 70 },
];

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
};

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('Eval Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({
      push: mockPush,
    });

    // Setup default mock implementations
    const { getAllClasses } = require('@/utils/queries/classes/get-all-classes');
    const { getAllAgents } = require('@/utils/queries/agents/get-all-agents');
    const { getAllScenarios } = require('@/utils/queries/scenarios/get-all-scenarios');
    const { getAllRubrics } = require('@/utils/queries/rubrics/get-all-rubrics');

    getAllClasses.mockResolvedValue(mockClasses);
    getAllAgents.mockResolvedValue(mockAgents);
    getAllScenarios.mockResolvedValue(mockScenarios);
    getAllRubrics.mockResolvedValue(mockRubrics);
  });

  describe('Create Mode', () => {
    it('renders create form correctly', async () => {
      renderWithQueryClient(<Eval mode="create" />);
      
      await waitFor(() => {
        expect(screen.getByText('Basic Information')).toBeInTheDocument();
        expect(screen.getByText('Configuration Settings')).toBeInTheDocument();
        expect(screen.getByText('Scenarios *')).toBeInTheDocument();
        expect(screen.getByText('Evaluation Agents *')).toBeInTheDocument();
        expect(screen.getByText('Evaluation Rubrics *')).toBeInTheDocument();
      });
    });

    it('has correct initial form values', async () => {
      renderWithQueryClient(<Eval mode="create" />);
      
      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Evaluation Name/) as HTMLInputElement;
        const maxTurnsInput = screen.getByLabelText(/Max Turns/) as HTMLInputElement;
        const parallelRunsInput = screen.getByLabelText(/Parallel Runs/) as HTMLInputElement;
        
        expect(nameInput.value).toBe('');
        expect(maxTurnsInput.value).toBe('10');
        expect(parallelRunsInput.value).toBe('1');
      });
    });

    it('shows create button', async () => {
      renderWithQueryClient(<Eval mode="create" />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Evaluation/ })).toBeInTheDocument();
      });
    });
  });

  describe('Edit Mode', () => {
    beforeEach(() => {
      const { getEval } = require('@/utils/queries/evals/get-eval');
      getEval.mockResolvedValue(mockEval);
    });

    it('renders edit form correctly', async () => {
      renderWithQueryClient(<Eval mode="edit" evalId="1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Basic Information')).toBeInTheDocument();
      });
    });

    it('loads eval data correctly', async () => {
      renderWithQueryClient(<Eval mode="edit" evalId="1" />);
      
      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Evaluation Name/) as HTMLInputElement;
        expect(nameInput.value).toBe('Test Eval');
      });
    });

    it('shows update button', async () => {
      renderWithQueryClient(<Eval mode="edit" evalId="1" />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Update Evaluation/ })).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('shows validation errors for empty required fields', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Eval mode="create" />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Evaluation/ })).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /Create Evaluation/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
        expect(screen.getByText('Description is required')).toBeInTheDocument();
        expect(screen.getByText('Base agent is required')).toBeInTheDocument();
        expect(screen.getByText('At least one scenario must be selected')).toBeInTheDocument();
        expect(screen.getByText('At least one agent must be selected')).toBeInTheDocument();
        expect(screen.getByText('At least one rubric must be selected')).toBeInTheDocument();
      });
    });

    it('validates max turns range', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Eval mode="create" />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Max Turns/)).toBeInTheDocument();
      });

      const maxTurnsInput = screen.getByLabelText(/Max Turns/);
      await user.clear(maxTurnsInput);
      await user.type(maxTurnsInput, '150');
      
      const submitButton = screen.getByRole('button', { name: /Create Evaluation/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Max turns must be between 1 and 100')).toBeInTheDocument();
      });
    });

    it('validates parallel runs range', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Eval mode="create" />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Parallel Runs/)).toBeInTheDocument();
      });

      const parallelRunsInput = screen.getByLabelText(/Parallel Runs/);
      await user.clear(parallelRunsInput);
      await user.type(parallelRunsInput, '15');
      
      const submitButton = screen.getByRole('button', { name: /Create Evaluation/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Parallel runs must be between 1 and 10')).toBeInTheDocument();
      });
    });
  });

  describe('Form Interactions', () => {
    it('updates form fields correctly', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Eval mode="create" />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Evaluation Name/)).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/Evaluation Name/);
      await user.type(nameInput, 'New Evaluation Name');
      
      expect(nameInput).toHaveValue('New Evaluation Name');
    });

    it('selects evaluation type correctly', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Eval mode="create" />);
      
      await waitFor(() => {
        expect(screen.getByText('Student')).toBeInTheDocument();
      });

      const evalTypeSelect = screen.getByRole('combobox');
      await user.click(evalTypeSelect);
      
      const taOption = screen.getByRole('option', { name: /Teaching Assistant/ });
      await user.click(taOption);
      
      expect(screen.getByText('Teaching Assistant')).toBeInTheDocument();
    });

    it('adds scenarios correctly', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Eval mode="create" />);
      
      await waitFor(() => {
        expect(screen.getByText('Add scenario')).toBeInTheDocument();
      });

      const addScenarioSelect = screen.getByRole('combobox', { name: /Add scenario/ });
      await user.click(addScenarioSelect);
      
      const scenarioOption = screen.getByRole('option', { name: /Test Scenario/ });
      await user.click(scenarioOption);
      
      await waitFor(() => {
        expect(screen.getByText('Test Scenario')).toBeInTheDocument();
      });
    });

    it('removes scenarios correctly', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Eval mode="create" />);
      
      await waitFor(() => {
        expect(screen.getByText('Add scenario')).toBeInTheDocument();
      });

      // First add a scenario
      const addScenarioSelect = screen.getByRole('combobox', { name: /Add scenario/ });
      await user.click(addScenarioSelect);
      
      const scenarioOption = screen.getByRole('option', { name: /Test Scenario/ });
      await user.click(scenarioOption);
      
      await waitFor(() => {
        expect(screen.getByText('Test Scenario')).toBeInTheDocument();
      });

      // Then remove it
      const removeButton = screen.getByRole('button', { name: '' }); // Trash icon button
      await user.click(removeButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Test Scenario')).not.toBeInTheDocument();
      });
    });
  });

  describe('Drag and Drop', () => {
    it('handles drag start correctly', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Eval mode="create" />);
      
      await waitFor(() => {
        expect(screen.getByText('Add scenario')).toBeInTheDocument();
      });

      // Add a scenario first
      const addScenarioSelect = screen.getByRole('combobox', { name: /Add scenario/ });
      await user.click(addScenarioSelect);
      
      const scenarioOption = screen.getByRole('option', { name: /Test Scenario/ });
      await user.click(scenarioOption);
      
      await waitFor(() => {
        expect(screen.getByText('Test Scenario')).toBeInTheDocument();
      });

      // The drag functionality would be tested with more complex setup
      // For now, just verify the scenario card is draggable
      const scenarioCard = screen.getByText('Test Scenario').closest('[draggable="true"]');
      expect(scenarioCard).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('submits create form successfully', async () => {
      const user = userEvent.setup();
      const { createEval } = require('@/utils/mutations/evals/create-eval');
      const { toast } = require('sonner');
      
      createEval.mockResolvedValue({ id: 'new-eval-id' });
      
      renderWithQueryClient(<Eval mode="create" />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Evaluation Name/)).toBeInTheDocument();
      });

      // Fill out the form
      await user.type(screen.getByLabelText(/Evaluation Name/), 'Test Evaluation');
      await user.type(screen.getByLabelText(/Description/), 'Test Description');
      
      // Select base agent
      const baseAgentSelect = screen.getByRole('combobox', { name: /Select base agent/ });
      await user.click(baseAgentSelect);
      const baseAgentOption = screen.getByRole('option', { name: /Base Agent/ });
      await user.click(baseAgentOption);
      
      // Add scenario
      const addScenarioSelect = screen.getByRole('combobox', { name: /Add scenario/ });
      await user.click(addScenarioSelect);
      const scenarioOption = screen.getByRole('option', { name: /Test Scenario/ });
      await user.click(scenarioOption);
      
      // Add agent
      const addAgentSelect = screen.getByRole('combobox', { name: /Add agent/ });
      await user.click(addAgentSelect);
      const agentOption = screen.getByRole('option', { name: /Test Agent/ });
      await user.click(agentOption);
      
      // Add rubric
      const addRubricSelect = screen.getByRole('combobox', { name: /Add rubric/ });
      await user.click(addRubricSelect);
      const rubricOption = screen.getByRole('option', { name: /Test Rubric/ });
      await user.click(rubricOption);
      
      const submitButton = screen.getByRole('button', { name: /Create Evaluation/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(createEval).toHaveBeenCalledWith({
          name: 'Test Evaluation',
          description: 'Test Description',
          baseAgentId: 'agent-1',
          scenarioIds: ['scenario-1'],
          agentIds: ['agent-2'],
          evalType: 'student',
          maxTurns: 10,
          maxParallelRuns: 1,
          rubricIds: ['rubric-1'],
        });
        expect(toast.success).toHaveBeenCalledWith('Evaluation created successfully!');
      });
    });

    it('handles create form submission error', async () => {
      const user = userEvent.setup();
      const { createEval } = require('@/utils/mutations/evals/create-eval');
      const { toast } = require('sonner');
      
      createEval.mockRejectedValue(new Error('Creation failed'));
      
      renderWithQueryClient(<Eval mode="create" />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Evaluation Name/)).toBeInTheDocument();
      });

      // Fill out required fields
      await user.type(screen.getByLabelText(/Evaluation Name/), 'Test Evaluation');
      await user.type(screen.getByLabelText(/Description/), 'Test Description');
      
      const submitButton = screen.getByRole('button', { name: /Create Evaluation/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create evaluation: Creation failed');
      });
    });
  });

  describe('Navigation', () => {
    it('navigates back on cancel', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Eval mode="create" />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /Cancel/ });
      await user.click(cancelButton);
      
      expect(mockPush).toHaveBeenCalledWith('/management/evals');
    });
  });

  describe('Loading States', () => {
    it('shows loading state when fetching eval data', () => {
      const { getEval } = require('@/utils/queries/evals/get-eval');
      getEval.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderWithQueryClient(<Eval mode="edit" evalId="1" />);
      
      expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
    });

    it('shows submitting state during form submission', async () => {
      const user = userEvent.setup();
      const { createEval } = require('@/utils/mutations/evals/create-eval');
      
      createEval.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderWithQueryClient(<Eval mode="create" />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Evaluation Name/)).toBeInTheDocument();
      });

      // Fill out required fields minimally
      await user.type(screen.getByLabelText(/Evaluation Name/), 'Test');
      await user.type(screen.getByLabelText(/Description/), 'Test');
      
      const submitButton = screen.getByRole('button', { name: /Create Evaluation/ });
      await user.click(submitButton);
      
      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });
  });

  it('matches snapshot', async () => {
    const { container } = renderWithQueryClient(<Eval mode="create" />);
    
    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });
    
    expect(container.firstChild).toMatchSnapshot();
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
