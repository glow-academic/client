/**
 * EvaluationRun.test.tsx
 * Test suite for the EvaluationRun component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useRouter } from 'next/navigation';
import EvaluationRun from '@/components/common/chat/EvaluationRun';

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
vi.mock('@/utils/queries/evaluation_runs/get-evaluation-run', () => ({
  getEvaluationRun: vi.fn(),
}));

vi.mock('@/utils/queries/evals/get-eval', () => ({
  getEval: vi.fn(),
}));

vi.mock('@/utils/queries/scenarios/get-all-scenarios', () => ({
  getAllScenarios: vi.fn(),
}));

vi.mock('@/utils/queries/agents/get-all-agents', () => ({
  getAllAgents: vi.fn(),
}));

vi.mock('@/utils/queries/evaluation_run_results/get-evaluation-run-results-by-run', () => ({
  getEvaluationRunResultsByRun: vi.fn(),
}));

vi.mock('@/utils/queries/simulation_attempts/get-simulation-attempts-by-evaluation-run-results', () => ({
  getSimulationAttemptsByEvaluationRunResults: vi.fn(),
}));

vi.mock('@/utils/queries/simulation_chats/get-simulation-chats-by-attempts', () => ({
  getSimulationChatsByAttempts: vi.fn(),
}));

vi.mock('@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats', () => ({
  getSimulationChatGradesBySimulationChats: vi.fn(),
}));

// Mock components
vi.mock('@/components/common/chat/Markdown', () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

// Mock data
const mockEvaluationRun = {
  id: 'run1',
  evalId: 'eval1',
  status: 'pending',
  createdAt: new Date().toISOString(),
  completedAt: null,
  totalAgents: 3,
  completedAgents: 0,
};

const mockEval = {
  id: 'eval1',
  name: 'Student Assessment 1',
  description: 'Evaluate TA performance with different student types',
  scenarioIds: ['scenario1', 'scenario2'],
  agentIds: ['agent1', 'agent2', 'agent3'],
  maxTurns: 10,
  maxParallelRuns: 2,
};

const mockScenarios = [
  {
    id: 'scenario1',
    name: 'Confused Student',
    description: 'Student needs help understanding basic concepts',
    agentId: 'agent1',
  },
  {
    id: 'scenario2',
    name: 'Advanced Student',
    description: 'Student asking complex questions',
    agentId: 'agent2',
  },
];

const mockAgents = [
  {
    id: 'agent1',
    name: 'Confused Student',
    subtitle: 'Needs basic help',
    agentType: 'student',
  },
  {
    id: 'agent2',
    name: 'Advanced Student',
    subtitle: 'Asks complex questions',
    agentType: 'student',
  },
  {
    id: 'agent3',
    name: 'Eager Student',
    subtitle: 'Very enthusiastic',
    agentType: 'student',
  },
];

const mockResults = [
  {
    id: 'result1',
    evaluationRunId: 'run1',
    agentId: 'agent1',
    scenarioId: 'scenario1',
    status: 'completed',
    score: 85,
    passed: true,
  },
];

const mockAttempts = [
  {
    id: 'attempt1',
    evaluationRunResultId: 'result1',
    profileId: 'profile1',
    simulationId: 'simulation1',
    createdAt: new Date().toISOString(),
  },
];

const mockChats = [
  {
    id: 'chat1',
    attemptId: 'attempt1',
    scenarioId: 'scenario1',
    completed: true,
    title: 'Chat with Confused Student',
  },
];

const mockGrades = [
  {
    id: 'grade1',
    simulationChatId: 'chat1',
    score: 85,
    passed: true,
    timeTaken: 300,
  },
];

describe('EvaluationRun Component', () => {
  let queryClient: QueryClient;
  let mockPush: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockPush = vi.fn();
    (useRouter as any).mockReturnValue({
      push: mockPush,
    });

    // Mock all query functions
    const { getEvaluationRun } = require('@/utils/queries/evaluation_runs/get-evaluation-run');
    const { getEval } = require('@/utils/queries/evals/get-eval');
    const { getAllScenarios } = require('@/utils/queries/scenarios/get-all-scenarios');
    const { getAllAgents } = require('@/utils/queries/agents/get-all-agents');
    const { getEvaluationRunResultsByRun } = require('@/utils/queries/evaluation_run_results/get-evaluation-run-results-by-run');
    const { getSimulationAttemptsByEvaluationRunResults } = require('@/utils/queries/simulation_attempts/get-simulation-attempts-by-evaluation-run-results');
    const { getSimulationChatsByAttempts } = require('@/utils/queries/simulation_chats/get-simulation-chats-by-attempts');
    const { getSimulationChatGradesBySimulationChats } = require('@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats');

    getEvaluationRun.mockResolvedValue(mockEvaluationRun);
    getEval.mockResolvedValue(mockEval);
    getAllScenarios.mockResolvedValue(mockScenarios);
    getAllAgents.mockResolvedValue(mockAgents);
    getEvaluationRunResultsByRun.mockResolvedValue(mockResults);
    getSimulationAttemptsByEvaluationRunResults.mockResolvedValue(mockAttempts);
    getSimulationChatsByAttempts.mockResolvedValue(mockChats);
    getSimulationChatGradesBySimulationChats.mockResolvedValue(mockGrades);

    // Mock fetch for starting evaluation
    global.fetch = vi.fn();
  });

  const renderEvaluationRun = (runId = 'run1') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <EvaluationRun runId={runId} />
      </QueryClientProvider>
    );
  };

  it('renders loading state initially', () => {
    renderEvaluationRun();
    expect(screen.getByText('Loading evaluation run...')).toBeInTheDocument();
  });

  it('displays evaluation run information when loaded', async () => {
    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText('Student Assessment 1')).toBeInTheDocument();
    });

    expect(screen.getByText('Evaluate TA performance with different student types')).toBeInTheDocument();
    expect(screen.getByText('Max Turns: 10')).toBeInTheDocument();
    expect(screen.getByText('Parallel Runs: 2')).toBeInTheDocument();
  });

  it('displays scenarios and agents correctly', async () => {
    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText('Confused Student')).toBeInTheDocument();
    });

    expect(screen.getByText('Advanced Student')).toBeInTheDocument();
    expect(screen.getByText('Eager Student')).toBeInTheDocument();
  });

  it('shows start evaluation button when status is pending', async () => {
    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText('Start Evaluation')).toBeInTheDocument();
    });

    expect(screen.getByText('Start Evaluation')).not.toBeDisabled();
  });

  it('handles starting evaluation', async () => {
    const mockStartResponse = {
      ok: true,
      json: () => Promise.resolve({ success: true }),
    };

    (global.fetch as any).mockResolvedValue(mockStartResponse);

    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText('Start Evaluation')).toBeInTheDocument();
    });

    const startButton = screen.getByText('Start Evaluation');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/evaluations/start'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  it('displays running status correctly', async () => {
    const runningEvaluationRun = {
      ...mockEvaluationRun,
      status: 'running',
      completedAgents: 1,
    };

    const { getEvaluationRun } = require('@/utils/queries/evaluation_runs/get-evaluation-run');
    getEvaluationRun.mockResolvedValue(runningEvaluationRun);

    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText('Running...')).toBeInTheDocument();
    });

    expect(screen.getByText('Progress: 1/3 agents completed')).toBeInTheDocument();
  });

  it('displays completed status with results', async () => {
    const completedEvaluationRun = {
      ...mockEvaluationRun,
      status: 'completed',
      completedAgents: 3,
      completedAt: new Date().toISOString(),
    };

    const { getEvaluationRun } = require('@/utils/queries/evaluation_runs/get-evaluation-run');
    getEvaluationRun.mockResolvedValue(completedEvaluationRun);

    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    expect(screen.getByText('All agents completed')).toBeInTheDocument();
  });

  it('displays evaluation results when available', async () => {
    const completedEvaluationRun = {
      ...mockEvaluationRun,
      status: 'completed',
      completedAgents: 3,
    };

    const { getEvaluationRun } = require('@/utils/queries/evaluation_runs/get-evaluation-run');
    getEvaluationRun.mockResolvedValue(completedEvaluationRun);

    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText('Evaluation Results')).toBeInTheDocument();
    });

    expect(screen.getByText('Score: 85')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
  });

  it('handles polling for status updates', async () => {
    const runningEvaluationRun = {
      ...mockEvaluationRun,
      status: 'running',
      completedAgents: 1,
    };

    const completedEvaluationRun = {
      ...mockEvaluationRun,
      status: 'completed',
      completedAgents: 3,
    };

    const { getEvaluationRun } = require('@/utils/queries/evaluation_runs/get-evaluation-run');
    getEvaluationRun
      .mockResolvedValueOnce(runningEvaluationRun)
      .mockResolvedValueOnce(completedEvaluationRun);

    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText('Running...')).toBeInTheDocument();
    });

    // Wait for polling to update status
    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
    }, { timeout: 6000 });
  });

  it('displays error state when evaluation fails', async () => {
    const failedEvaluationRun = {
      ...mockEvaluationRun,
      status: 'failed',
      error: 'Evaluation failed due to timeout',
    };

    const { getEvaluationRun } = require('@/utils/queries/evaluation_runs/get-evaluation-run');
    getEvaluationRun.mockResolvedValue(failedEvaluationRun);

    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    expect(screen.getByText('Evaluation failed due to timeout')).toBeInTheDocument();
  });

  it('handles scroll to bottom functionality', async () => {
    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText('Student Assessment 1')).toBeInTheDocument();
    });

    // Simulate scroll event
    const scrollArea = document.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollArea) {
      Object.defineProperty(scrollArea, 'scrollHeight', { value: 1000 });
      Object.defineProperty(scrollArea, 'clientHeight', { value: 400 });
      Object.defineProperty(scrollArea, 'scrollTop', { value: 0 });

      fireEvent.scroll(scrollArea);

      // Check if scroll button appears
      const scrollButton = screen.queryByTestId('scroll-to-bottom-button');
      if (scrollButton) {
        fireEvent.click(scrollButton);
      }
    }
  });

  it('displays agent-scenario combinations correctly', async () => {
    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText('Agent-Scenario Combinations')).toBeInTheDocument();
    });

    // Should show combinations for each agent with each scenario
    expect(screen.getByText('Confused Student × Confused Student')).toBeInTheDocument();
    expect(screen.getByText('Advanced Student × Advanced Student')).toBeInTheDocument();
  });

  it('handles navigation back to evaluations', async () => {
    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText('Back to Evaluations')).toBeInTheDocument();
    });

    const backButton = screen.getByText('Back to Evaluations');
    fireEvent.click(backButton);

    expect(mockPush).toHaveBeenCalledWith('/management/evals');
  });

  it('displays time taken for completed evaluations', async () => {
    const completedEvaluationRun = {
      ...mockEvaluationRun,
      status: 'completed',
      completedAgents: 3,
      completedAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes later
    };

    const { getEvaluationRun } = require('@/utils/queries/evaluation_runs/get-evaluation-run');
    getEvaluationRun.mockResolvedValue(completedEvaluationRun);

    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText('Time Taken: 5:00')).toBeInTheDocument();
    });
  });

  it('handles error when evaluation run not found', async () => {
    const { getEvaluationRun } = require('@/utils/queries/evaluation_runs/get-evaluation-run');
    getEvaluationRun.mockRejectedValue(new Error('Not found'));

    renderEvaluationRun('invalid-run');

    await waitFor(() => {
      expect(screen.getByText('Evaluation run not found')).toBeInTheDocument();
    });
  });

  it('displays loading dots animation during running state', async () => {
    const runningEvaluationRun = {
      ...mockEvaluationRun,
      status: 'running',
      completedAgents: 1,
    };

    const { getEvaluationRun } = require('@/utils/queries/evaluation_runs/get-evaluation-run');
    getEvaluationRun.mockResolvedValue(runningEvaluationRun);

    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText('Running...')).toBeInTheDocument();
    });

    // Check for loading dots animation
    const loadingDots = document.querySelectorAll('.animate-pulse');
    expect(loadingDots.length).toBeGreaterThan(0);
  });
});
