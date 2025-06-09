import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import Agent from '@/components/common/agent/Agent';

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
vi.mock('@/utils/queries/agents/get-agent', () => ({
  getAgent: vi.fn(),
}));

vi.mock('@/utils/mutations/agents/create-agent', () => ({
  createAgent: vi.fn(),
}));

vi.mock('@/utils/mutations/agents/update-agent', () => ({
  updateAgent: vi.fn(),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Agent', () => {
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

  describe('Rendering', () => {
    it('should render create mode by default', () => {
      renderWithProviders(<Agent />);
      
      expect(screen.getByText('Create Agent')).toBeInTheDocument();
      expect(screen.getByText('Create a new AI student agent with specific personality and behavior characteristics')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create agent/i })).toBeInTheDocument();
    });

    it('should render edit mode when agentId is provided', () => {
      renderWithProviders(<Agent agentId="test-id" mode="edit" />);
      
      expect(screen.getByText('Edit Agent')).toBeInTheDocument();
      expect(screen.getByText('Modify the personality and behavior characteristics for this AI student agent')).toBeInTheDocument();
    });

    it('should have correct accessibility attributes', () => {
      renderWithProviders(<Agent />);
      
      const nameInput = screen.getByLabelText(/agent name/i);
      const subtitleInput = screen.getByLabelText(/subtitle/i);
      const descriptionTextarea = screen.getByLabelText(/description/i);
      const systemPromptTextarea = screen.getByLabelText(/system prompt/i);
      
      expect(nameInput).toHaveAttribute('required');
      expect(nameInput).toHaveAttribute('placeholder', 'e.g., Enthusiastic Student Agent');
      expect(subtitleInput).toHaveAttribute('required');
      expect(descriptionTextarea).toHaveAttribute('required');
      expect(systemPromptTextarea).toHaveAttribute('required');
    });
  });

  describe('User Interactions', () => {
    it('should handle form submissions for create mode', async () => {
      const { createAgent } = await import('@/utils/mutations/agents/create-agent');
      (createAgent as any).mockResolvedValue({ id: 'new-agent-id' });

      const user = userEvent.setup();
      renderWithProviders(<Agent />);
      
      const nameInput = screen.getByLabelText(/agent name/i);
      const subtitleInput = screen.getByLabelText(/subtitle/i);
      const descriptionTextarea = screen.getByLabelText(/description/i);
      const systemPromptTextarea = screen.getByLabelText(/system prompt/i);
      const submitButton = screen.getByRole('button', { name: /create agent/i });

      await user.type(nameInput, 'Test Agent');
      await user.type(subtitleInput, 'Test Subtitle');
      await user.type(descriptionTextarea, 'Test Description');
      await user.type(systemPromptTextarea, 'Test System Prompt');
      await user.click(submitButton);

      await waitFor(() => {
        expect(createAgent).toHaveBeenCalledWith({
          name: 'Test Agent',
          subtitle: 'Test Subtitle',
          description: 'Test Description',
          systemPrompt: 'Test System Prompt',
          agentType: 'student',
          temperature: 0,
        });
      });
    });

    it('should handle cancel button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Agent />);
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockPush).toHaveBeenCalledWith('/management/agents');
    });

    it('should validate required fields', async () => {
      const { toast } = await import('sonner');
      const user = userEvent.setup();
      renderWithProviders(<Agent />);
      
      const submitButton = screen.getByRole('button', { name: /create agent/i });
      await user.click(submitButton);

      expect(toast.error).toHaveBeenCalledWith('Agent name is required');
    });
  });

  describe('API Integration', () => {
    it('should handle loading states in edit mode', () => {
      renderWithProviders(<Agent agentId="test-id" mode="edit" />);
      
      // Should show skeleton loading state
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('should handle error states when agent not found', async () => {
      const { getAgent } = await import('@/utils/queries/agents/get-agent');
      (getAgent as any).mockResolvedValue(null);

      renderWithProviders(<Agent agentId="non-existent-id" mode="edit" />);
      
      await waitFor(() => {
        expect(screen.getByText('Agent Not Found')).toBeInTheDocument();
        expect(screen.getByText("The agent you're looking for doesn't exist.")).toBeInTheDocument();
      });
    });
  });
});

/*
 * Component Analysis for Agent:
 * Path: common/agent/Agent.tsx
 * 
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true (AgentProps interface)
 * - Props interface: AgentProps with agentId and mode
 * - Client component: true
 * - Uses hooks: useState, useEffect, useRouter, useQuery
 * - Uses router: true
 * - Has API calls: true (getAgent, createAgent, updateAgent)
 * - Has form handling: true
 * - Uses state: true
 * - Uses effects: true
 * - Uses context: false
 * 
 * The component now supports both create and edit modes with proper form handling,
 * API integration, loading states, and error handling.
 */
