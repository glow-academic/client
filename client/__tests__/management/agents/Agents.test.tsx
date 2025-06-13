/**
 * Agents.test.tsx
 * Test suite for the Agents management component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useRouter } from 'next/navigation';
import Agents from '@/components/management/agents/Agents';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the queries
vi.mock('@/utils/queries/agents/get-all-agents', () => ({
  getAllAgents: vi.fn(),
}));

vi.mock('@/utils/mutations/agents/delete-agent', () => ({
  deleteAgent: vi.fn(),
}));

// Mock data
const mockAgents = [
  {
    id: 'agent1',
    name: 'Helpful Assistant',
    subtitle: 'A friendly and helpful AI assistant',
    agentType: 'student',
    systemPrompt: 'You are a helpful assistant.',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'agent2',
    name: 'Strict Teacher',
    subtitle: 'A demanding but fair educator',
    agentType: 'instructor',
    systemPrompt: 'You are a strict teacher.',
    createdAt: '2024-01-02T00:00:00Z',
  },
  {
    id: 'agent3',
    name: 'Curious Student',
    subtitle: 'An eager learner with many questions',
    agentType: 'student',
    systemPrompt: 'You are a curious student.',
    createdAt: '2024-01-03T00:00:00Z',
  },
];

describe('Agents Component', () => {
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
    const { getAllAgents } = require('@/utils/queries/agents/get-all-agents');
    getAllAgents.mockResolvedValue(mockAgents);
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Agents />
      </QueryClientProvider>
    );
  };

  it('renders agent cards when data is loaded', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Helpful Assistant')).toBeInTheDocument();
      expect(screen.getByText('Strict Teacher')).toBeInTheDocument();
      expect(screen.getByText('Curious Student')).toBeInTheDocument();
    });

    expect(screen.getByText('A friendly and helpful AI assistant')).toBeInTheDocument();
    expect(screen.getByText('A demanding but fair educator')).toBeInTheDocument();
    expect(screen.getByText('An eager learner with many questions')).toBeInTheDocument();
  });

  it('displays agent type badges correctly', async () => {
    renderComponent();

    await waitFor(() => {
      const studentBadges = screen.getAllByText('Student');
      expect(studentBadges).toHaveLength(2);
      expect(screen.getByText('Instructor')).toBeInTheDocument();
    });
  });

  it('displays creation dates', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Created Jan 1, 2024')).toBeInTheDocument();
      expect(screen.getByText('Created Jan 2, 2024')).toBeInTheDocument();
      expect(screen.getByText('Created Jan 3, 2024')).toBeInTheDocument();
    });
  });

  it('handles create new agent action', async () => {
    renderComponent();

    await waitFor(() => {
      const createButton = screen.getByText('Create New Agent');
      fireEvent.click(createButton);
    });

    expect(mockPush).toHaveBeenCalledWith('/management/agents/new');
  });

  it('handles edit agent action', async () => {
    renderComponent();

    await waitFor(() => {
      const editButtons = screen.getAllByLabelText('Edit agent');
      fireEvent.click(editButtons[0]);
    });

    expect(mockPush).toHaveBeenCalledWith('/management/agents/a/agent1/edit');
  });

  it('opens delete confirmation dialog', async () => {
    renderComponent();

    await waitFor(() => {
      const deleteButtons = screen.getAllByLabelText('Delete agent');
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('Are you sure?')).toBeInTheDocument();
      expect(screen.getByText(/permanently delete the agent "Helpful Assistant"/)).toBeInTheDocument();
    });
  });

  it('handles delete agent', async () => {
    const { deleteAgent } = require('@/utils/mutations/agents/delete-agent');
    deleteAgent.mockResolvedValue({});

    renderComponent();

    await waitFor(() => {
      const deleteButtons = screen.getAllByLabelText('Delete agent');
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      const confirmButton = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(deleteAgent).toHaveBeenCalledWith('agent1');
    });
  });

  it('shows empty state when no agents exist', async () => {
    const { getAllAgents } = require('@/utils/queries/agents/get-all-agents');
    getAllAgents.mockResolvedValue([]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('No agents yet')).toBeInTheDocument();
      expect(screen.getByText('Create your first agent to get started with AI interactions')).toBeInTheDocument();
      expect(screen.getByText('Create Your First Agent')).toBeInTheDocument();
    });
  });

  it('handles create first agent from empty state', async () => {
    const { getAllAgents } = require('@/utils/queries/agents/get-all-agents');
    getAllAgents.mockResolvedValue([]);

    renderComponent();

    await waitFor(() => {
      const createButton = screen.getByText('Create Your First Agent');
      fireEvent.click(createButton);
    });

    expect(mockPush).toHaveBeenCalledWith('/management/agents/new');
  });

  it('displays system prompt preview', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('You are a helpful assistant.')).toBeInTheDocument();
      expect(screen.getByText('You are a strict teacher.')).toBeInTheDocument();
      expect(screen.getByText('You are a curious student.')).toBeInTheDocument();
    });
  });

  it('handles delete error gracefully', async () => {
    const { deleteAgent } = require('@/utils/mutations/agents/delete-agent');
    const { toast } = require('sonner');
    deleteAgent.mockRejectedValue(new Error('Delete failed'));

    renderComponent();

    await waitFor(() => {
      const deleteButtons = screen.getAllByLabelText('Delete agent');
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      const confirmButton = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to delete agent');
    });
  });

  it('cancels delete dialog', async () => {
    renderComponent();

    await waitFor(() => {
      const deleteButtons = screen.getAllByLabelText('Delete agent');
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);
    });

    await waitFor(() => {
      expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
    });
  });

  it('shows loading state during deletion', async () => {
    const { deleteAgent } = require('@/utils/mutations/agents/delete-agent');
    deleteAgent.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderComponent();

    await waitFor(() => {
      const deleteButtons = screen.getAllByLabelText('Delete agent');
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      const confirmButton = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Deleting...')).toBeInTheDocument();
    });
  });

  it('displays agent cards in grid layout', async () => {
    renderComponent();

    await waitFor(() => {
      const agentCards = screen.getAllByRole('article');
      expect(agentCards).toHaveLength(3);
    });
  });

  it('truncates long system prompts', async () => {
    const longPromptAgent = {
      ...mockAgents[0],
      systemPrompt: 'This is a very long system prompt that should be truncated when displayed in the card view to prevent the UI from becoming cluttered and unreadable.',
    };

    const { getAllAgents } = require('@/utils/queries/agents/get-all-agents');
    getAllAgents.mockResolvedValue([longPromptAgent]);

    renderComponent();

    await waitFor(() => {
      // Should show truncated version
      expect(screen.getByText(/This is a very long system prompt/)).toBeInTheDocument();
    });
  });

  it('handles agent type filtering', async () => {
    renderComponent();

    await waitFor(() => {
      // All agents should be visible initially
      expect(screen.getByText('Helpful Assistant')).toBeInTheDocument();
      expect(screen.getByText('Strict Teacher')).toBeInTheDocument();
      expect(screen.getByText('Curious Student')).toBeInTheDocument();
    });
  });

  it('displays correct agent count', async () => {
    renderComponent();

    await waitFor(() => {
      // Should show all 3 agents
      const agentCards = screen.getAllByRole('article');
      expect(agentCards).toHaveLength(3);
    });
  });
});
