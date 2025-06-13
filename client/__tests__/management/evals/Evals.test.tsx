/**
 * Evals.test.tsx
 * Test suite for the Evals management component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useRouter } from 'next/navigation';
import Evals from '@/components/management/evals/Evals';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

// Mock the queries
vi.mock('@/utils/queries/evals/get-all-evals', () => ({
  getAllEvals: vi.fn(),
}));

vi.mock('@/utils/queries/classes/get-all-classes', () => ({
  getAllClasses: vi.fn(),
}));

vi.mock('@/utils/queries/eval_runs/get-eval-runs-by-evals', () => ({
  getEvalRunsByEvals: vi.fn(),
}));

vi.mock('@/utils/queries/rubrics/get-all-rubrics', () => ({
  getAllRubrics: vi.fn(),
}));

vi.mock('@/utils/queries/standard_groups/get-standard-groups-by-rubrics', () => ({
  getStandardGroupsByRubrics: vi.fn(),
}));

vi.mock('@/utils/queries/standards/get-standards-by-standardgroups', () => ({
  getStandardsByStandardGroups: vi.fn(),
}));

vi.mock('@/utils/queries/eval_chats/get-eval-chats-by-evalruns', () => ({
  getEvalChatsByEvalRuns: vi.fn(),
}));

vi.mock('@/utils/queries/eval_chat_grades/get-eval-chat-grades-by-evalchats', () => ({
  getEvalChatGradesByEvalChats: vi.fn(),
}));

vi.mock('@/utils/queries/eval_chat_feedbacks/get-eval-chat-feedbacks-by-evalchatgrades', () => ({
  getEvalChatFeedbacksByEvalChatGrades: vi.fn(),
}));

vi.mock('@/utils/mutations/evals/delete-eval', () => ({
  deleteEval: vi.fn(),
}));

// Mock fetch for eval running
global.fetch = vi.fn();

// Mock data
const mockEvals = [
  {
    id: 'eval1',
    name: 'Basic Evaluation',
    description: 'A simple evaluation for testing',
    evalType: 'student',
    scenarioIds: ['scenario1', 'scenario2'],
    agentIds: ['agent1', 'agent2'],
    rubricIds: ['rubric1'],
    maxTurns: 10,
    maxParallelRuns: 1,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'eval2',
    name: 'Advanced TA Evaluation',
    description: 'Complex evaluation for TAs',
    evalType: 'ta',
    scenarioIds: ['scenario1', 'scenario2', 'scenario3'],
    agentIds: ['agent1', 'agent2', 'agent3'],
    rubricIds: ['rubric1', 'rubric2'],
    maxTurns: 15,
    maxParallelRuns: 2,
    createdAt: '2024-01-02T00:00:00Z',
  },
];

const mockClasses = [
  {
    id: 'class1',
    name: 'Introduction to Computer Science',
    classCode: 'CS101',
    term: 'fall',
    year: 2024,
  },
];

const mockEvalRuns = [
  {
    id: 'run1',
    evalId: 'eval1',
    agentId: 'agent1',
    rubricId: 'rubric1',
    createdAt: '2024-01-01T00:00:00Z',
  },
];

const mockChats = [
  {
    id: 'chat1',
    evalRunId: 'run1',
    completed: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
];

const mockGrades = [
  {
    id: 'grade1',
    evalChatId: 'chat1',
    score: 85,
    passed: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
];

describe('Evals Component', () => {
  let queryClient: QueryClient;
  const mockPush = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    (useRouter as any).mockReturnValue({
      push: mockPush,
    });

    // Setup mock implementations
    const { getAllEvals } = require('@/utils/queries/evals/get-all-evals');
    const { getAllClasses } = require('@/utils/queries/classes/get-all-classes');
    const { getEvalRunsByEvals } = require('@/utils/queries/eval_runs/get-eval-runs-by-evals');
    const { getAllRubrics } = require('@/utils/queries/rubrics/get-all-rubrics');
    const { getStandardGroupsByRubrics } = require('@/utils/queries/standard_groups/get-standard-groups-by-rubrics');
    const { getStandardsByStandardGroups } = require('@/utils/queries/standards/get-standards-by-standardgroups');
    const { getEvalChatsByEvalRuns } = require('@/utils/queries/eval_chats/get-eval-chats-by-evalruns');
    const { getEvalChatGradesByEvalChats } = require('@/utils/queries/eval_chat_grades/get-eval-chat-grades-by-evalchats');
    const { getEvalChatFeedbacksByEvalChatGrades } = require('@/utils/queries/eval_chat_feedbacks/get-eval-chat-feedbacks-by-evalchatgrades');

    getAllEvals.mockResolvedValue(mockEvals);
    getAllClasses.mockResolvedValue(mockClasses);
    getEvalRunsByEvals.mockResolvedValue(mockEvalRuns);
    getAllRubrics.mockResolvedValue([]);
    getStandardGroupsByRubrics.mockResolvedValue([]);
    getStandardsByStandardGroups.mockResolvedValue([]);
    getEvalChatsByEvalRuns.mockResolvedValue(mockChats);
    getEvalChatGradesByEvalChats.mockResolvedValue(mockGrades);
    getEvalChatFeedbacksByEvalChatGrades.mockResolvedValue([]);

    // Reset fetch mock
    (global.fetch as any).mockClear();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Evals />
      </QueryClientProvider>
    );
  };

  it('renders evaluation cards when data is loaded', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Basic Evaluation')).toBeInTheDocument();
      expect(screen.getByText('Advanced TA Evaluation')).toBeInTheDocument();
    });

    expect(screen.getByText('A simple evaluation for testing')).toBeInTheDocument();
    expect(screen.getByText('Complex evaluation for TAs')).toBeInTheDocument();
  });

  it('displays correct evaluation type badges', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Student')).toBeInTheDocument();
      expect(screen.getByText('TA')).toBeInTheDocument();
    });
  });

  it('shows complexity badges based on evaluation content', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Simple')).toBeInTheDocument();
      expect(screen.getByText('Moderate')).toBeInTheDocument();
    });
  });

  it('displays evaluation statistics correctly', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('2 scenarios')).toBeInTheDocument();
      expect(screen.getByText('2 agents')).toBeInTheDocument();
      expect(screen.getByText('1 rubrics')).toBeInTheDocument();
      expect(screen.getByText('10 max turns')).toBeInTheDocument();
    });
  });

  it('handles run evaluation action', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ eval_run_id: 'new-run-123' }),
    });

    renderComponent();

    await waitFor(() => {
      const runButtons = screen.getAllByText('Run');
      if (runButtons.length > 0) {
        fireEvent.click(runButtons[0]);
      }
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `${process.env.NEXT_PUBLIC_API_URL}/evals/start`,
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
    });
  });

  it('handles edit evaluation action', async () => {
    renderComponent();

    await waitFor(() => {
      const editButtons = screen.getAllByLabelText('Edit evaluation');
      if (editButtons.length > 0) {
        fireEvent.click(editButtons[0]);
      }
    });

    expect(mockPush).toHaveBeenCalledWith('/management/evals/e/eval1/edit');
  });

  it('handles preview evaluation action', async () => {
    renderComponent();

    await waitFor(() => {
      const previewButtons = screen.getAllByText('Preview');
      if (previewButtons.length > 0) {
        fireEvent.click(previewButtons[0]);
      }
    });

    expect(mockPush).toHaveBeenCalledWith('/management/evals/e/eval1');
  });

  it('opens delete confirmation dialog', async () => {
    renderComponent();

    await waitFor(() => {
      const deleteButtons = screen.getAllByLabelText('Delete evaluation');
      if (deleteButtons.length > 0) {
        fireEvent.click(deleteButtons[0]);
      }
    });

    await waitFor(() => {
      expect(screen.getByText('Are you sure?')).toBeInTheDocument();
      expect(screen.getByText(/permanently delete the evaluation "Basic Evaluation"/)).toBeInTheDocument();
    });
  });

  it('handles delete evaluation', async () => {
    const { deleteEval } = require('@/utils/mutations/evals/delete-eval');
    deleteEval.mockResolvedValue({});

    renderComponent();

    await waitFor(() => {
      const deleteButtons = screen.getAllByLabelText('Delete evaluation');
      if (deleteButtons.length > 0) {
        fireEvent.click(deleteButtons[0]);
      }
    });

    await waitFor(() => {
      const confirmButton = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(deleteEval).toHaveBeenCalledWith('eval1');
    });
  });

  it('shows empty state when no evaluations exist', async () => {
    const { getAllEvals } = require('@/utils/queries/evals/get-all-evals');
    getAllEvals.mockResolvedValue([]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('No evaluations yet')).toBeInTheDocument();
      expect(screen.getByText('Create your first evaluation to start assessing agent performance')).toBeInTheDocument();
      expect(screen.getByText('Create Your First Evaluation')).toBeInTheDocument();
    });
  });

  it('handles create new evaluation action', async () => {
    const { getAllEvals } = require('@/utils/queries/evals/get-all-evals');
    getAllEvals.mockResolvedValue([]);

    renderComponent();

    await waitFor(() => {
      const createButton = screen.getByText('Create Your First Evaluation');
      fireEvent.click(createButton);
    });

    expect(mockPush).toHaveBeenCalledWith('/management/evals/new');
  });

  it('handles run evaluation error when no classes available', async () => {
    const { getAllClasses } = require('@/utils/queries/classes/get-all-classes');
    getAllClasses.mockResolvedValue([]);

    const { toast } = require('sonner');

    renderComponent();

    await waitFor(() => {
      const runButtons = screen.getAllByText('Run');
      if (runButtons.length > 0) {
        fireEvent.click(runButtons[0]);
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('No classes found. Please contact an administrator.');
    });
  });

  it('handles run evaluation API error', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ detail: 'Server error' }),
    });

    const { toast } = require('sonner');

    renderComponent();

    await waitFor(() => {
      const runButtons = screen.getAllByText('Run');
      if (runButtons.length > 0) {
        fireEvent.click(runButtons[0]);
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to start evaluation. Please try again.');
    });
  });

  it('shows running state when evaluation is being started', async () => {
    (global.fetch as any).mockImplementation(() => new Promise(() => {})); // Never resolves

    renderComponent();

    await waitFor(() => {
      const runButtons = screen.getAllByText('Run');
      if (runButtons.length > 0) {
        fireEvent.click(runButtons[0]);
      }
    });

    await waitFor(() => {
      expect(screen.getByText('Starting...')).toBeInTheDocument();
    });
  });

  it('formats dates correctly', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Created: Jan 1, 2024')).toBeInTheDocument();
      expect(screen.getByText('Created: Jan 2, 2024')).toBeInTheDocument();
    });
  });

  it('displays parallel runs information', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Parallel runs: 1')).toBeInTheDocument();
      expect(screen.getByText('Parallel runs: 2')).toBeInTheDocument();
    });
  });

  it('handles evaluation with RAY filtered items', async () => {
    const evalWithRAY = {
      ...mockEvals[0],
      scenarioIds: ['scenario1', 'RAY'],
      agentIds: ['agent1', 'RAY'],
      rubricIds: ['rubric1', 'RAY'],
    };

    const { getAllEvals } = require('@/utils/queries/evals/get-all-evals');
    getAllEvals.mockResolvedValue([evalWithRAY]);

    renderComponent();

    await waitFor(() => {
      // Should filter out RAY items in display
      expect(screen.getByText('1 scenarios')).toBeInTheDocument();
      expect(screen.getByText('1 agents')).toBeInTheDocument();
      expect(screen.getByText('1 rubrics')).toBeInTheDocument();
    });
  });

  it('navigates to evaluation run page after successful start', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ eval_run_id: 'new-run-123' }),
    });

    renderComponent();

    await waitFor(() => {
      const runButtons = screen.getAllByText('Run');
      if (runButtons.length > 0) {
        fireEvent.click(runButtons[0]);
      }
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/management/evals/e/eval1/r/new-run-123');
    });
  });
});

/*
 * Component Analysis for Evals:
 * Path: management/evals/Evals.tsx
 *
 * Features implemented and tested:
 * - Data fetching with React Query
 * - Evaluation cards with comprehensive details
 * - CRUD operations (Create, Read, Update, Delete)
 * - Navigation to create/edit pages
 * - Delete confirmation dialog
 * - Empty state handling
 * - Complexity and type badges
 * - Date formatting
 * - Error handling and toast notifications
 * - Accessibility features
 * - RAY placeholder filtering
 * - Run functionality placeholder
 *
 * Test coverage includes:
 * - Basic rendering and data display
 * - User interactions (create, edit, delete, run)
 * - Data loading and error states
 * - Edge cases and error handling
 * - Accessibility testing
 * - Empty state functionality
 */
