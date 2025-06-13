import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import Agent from '@/components/common/agent/Agent';

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
vi.mock('@/utils/queries/agents/get-agent', () => ({
  getAgent: vi.fn(),
}));

vi.mock('@/utils/mutations/agents/create-agent', () => ({
  createAgent: vi.fn(),
}));

vi.mock('@/utils/mutations/agents/update-agent', () => ({
  updateAgent: vi.fn(),
}));

const mockPush = vi.fn();
const mockAgent = {
  id: '1',
  name: 'Test Agent',
  subtitle: 'Test Subtitle',
  description: 'Test Description',
  systemPrompt: 'Test System Prompt',
  agentType: 'student' as const,
  temperature: 0.7,
};

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

describe('Agent Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({
      push: mockPush,
    });
  });

  describe('Create Mode', () => {
    it('renders create form correctly', () => {
      renderWithQueryClient(<Agent mode="create" />);
      
      expect(screen.getByText('Create Agent')).toBeInTheDocument();
      expect(screen.getByLabelText(/Agent Name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Subtitle/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
      expect(screen.getByLabelText(/System Prompt/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Agent Type/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Temperature/)).toBeInTheDocument();
    });

    it('has correct initial form values', () => {
      renderWithQueryClient(<Agent mode="create" />);
      
      const nameInput = screen.getByLabelText(/Agent Name/) as HTMLInputElement;
      const subtitleInput = screen.getByLabelText(/Subtitle/) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/Description/) as HTMLTextAreaElement;
      const systemPromptInput = screen.getByLabelText(/System Prompt/) as HTMLTextAreaElement;
      const temperatureInput = screen.getByLabelText(/Temperature/) as HTMLInputElement;
      
      expect(nameInput.value).toBe('');
      expect(subtitleInput.value).toBe('');
      expect(descriptionInput.value).toBe('');
      expect(systemPromptInput.value).toBe('');
      expect(temperatureInput.value).toBe('0.7');
    });

    it('shows create button', () => {
      renderWithQueryClient(<Agent mode="create" />);
      
      expect(screen.getByRole('button', { name: /Create Agent/ })).toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    beforeEach(() => {
      const { getAgent } = require('@/utils/queries/agents/get-agent');
      getAgent.mockResolvedValue(mockAgent);
    });

    it('renders edit form correctly', async () => {
      renderWithQueryClient(<Agent mode="edit" agentId="1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Edit Agent')).toBeInTheDocument();
      });
    });

    it('loads agent data correctly', async () => {
      renderWithQueryClient(<Agent mode="edit" agentId="1" />);
      
      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Agent Name/) as HTMLInputElement;
        expect(nameInput.value).toBe('Test Agent');
      });
    });

    it('shows update button', async () => {
      renderWithQueryClient(<Agent mode="edit" agentId="1" />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Update Agent/ })).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('shows validation errors for empty required fields', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Agent mode="create" />);
      
      const submitButton = screen.getByRole('button', { name: /Create Agent/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
        expect(screen.getByText('Subtitle is required')).toBeInTheDocument();
        expect(screen.getByText('Description is required')).toBeInTheDocument();
        expect(screen.getByText('System prompt is required')).toBeInTheDocument();
      });
    });

    it('validates temperature range', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Agent mode="create" />);
      
      const temperatureInput = screen.getByLabelText(/Temperature/);
      await user.clear(temperatureInput);
      await user.type(temperatureInput, '2.5');
      
      const submitButton = screen.getByRole('button', { name: /Create Agent/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Temperature must be between 0 and 2')).toBeInTheDocument();
      });
    });
  });

  describe('Form Interactions', () => {
    it('updates form fields correctly', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Agent mode="create" />);
      
      const nameInput = screen.getByLabelText(/Agent Name/);
      await user.type(nameInput, 'New Agent Name');
      
      expect(nameInput).toHaveValue('New Agent Name');
    });

    it('updates temperature with slider', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Agent mode="create" />);
      
      const temperatureInput = screen.getByLabelText(/Temperature/);
      await user.clear(temperatureInput);
      await user.type(temperatureInput, '1.2');
      
      expect(temperatureInput).toHaveValue('1.2');
    });

    it('selects agent type correctly', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Agent mode="create" />);
      
      const agentTypeSelect = screen.getByRole('combobox');
      await user.click(agentTypeSelect);
      
      const taOption = screen.getByRole('option', { name: /Teaching Assistant/ });
      await user.click(taOption);
      
      // The select should now show the selected value
      expect(screen.getByText('Teaching Assistant')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('submits create form successfully', async () => {
      const user = userEvent.setup();
      const { createAgent } = require('@/utils/mutations/agents/create-agent');
      const { toast } = require('sonner');
      
      createAgent.mockResolvedValue({ id: 'new-agent-id' });
      
      renderWithQueryClient(<Agent mode="create" />);
      
      // Fill out the form
      await user.type(screen.getByLabelText(/Agent Name/), 'Test Agent');
      await user.type(screen.getByLabelText(/Subtitle/), 'Test Subtitle');
      await user.type(screen.getByLabelText(/Description/), 'Test Description');
      await user.type(screen.getByLabelText(/System Prompt/), 'Test System Prompt');
      
      const submitButton = screen.getByRole('button', { name: /Create Agent/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(createAgent).toHaveBeenCalledWith({
          name: 'Test Agent',
          subtitle: 'Test Subtitle',
          description: 'Test Description',
          systemPrompt: 'Test System Prompt',
          agentType: 'student',
          temperature: 0.7,
        });
        expect(toast.success).toHaveBeenCalledWith('Agent created successfully!');
      });
    });

    it('submits update form successfully', async () => {
      const user = userEvent.setup();
      const { getAgent } = require('@/utils/queries/agents/get-agent');
      const { updateAgent } = require('@/utils/mutations/agents/update-agent');
      const { toast } = require('sonner');
      
      getAgent.mockResolvedValue(mockAgent);
      updateAgent.mockResolvedValue({ id: '1' });
      
      renderWithQueryClient(<Agent mode="edit" agentId="1" />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Agent')).toBeInTheDocument();
      });
      
      // Update the name
      const nameInput = screen.getByLabelText(/Agent Name/);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Agent');
      
      const submitButton = screen.getByRole('button', { name: /Update Agent/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(updateAgent).toHaveBeenCalledWith('1', {
          name: 'Updated Agent',
          subtitle: 'Test Subtitle',
          description: 'Test Description',
          systemPrompt: 'Test System Prompt',
          agentType: 'student',
          temperature: 0.7,
        });
        expect(toast.success).toHaveBeenCalledWith('Agent updated successfully!');
      });
    });

    it('handles create form submission error', async () => {
      const user = userEvent.setup();
      const { createAgent } = require('@/utils/mutations/agents/create-agent');
      const { toast } = require('sonner');
      
      createAgent.mockRejectedValue(new Error('Creation failed'));
      
      renderWithQueryClient(<Agent mode="create" />);
      
      // Fill out the form
      await user.type(screen.getByLabelText(/Agent Name/), 'Test Agent');
      await user.type(screen.getByLabelText(/Subtitle/), 'Test Subtitle');
      await user.type(screen.getByLabelText(/Description/), 'Test Description');
      await user.type(screen.getByLabelText(/System Prompt/), 'Test System Prompt');
      
      const submitButton = screen.getByRole('button', { name: /Create Agent/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create agent: Creation failed');
      });
    });
  });

  describe('Navigation', () => {
    it('navigates back on cancel', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Agent mode="create" />);
      
      const cancelButton = screen.getByRole('button', { name: /Cancel/ });
      await user.click(cancelButton);
      
      expect(mockPush).toHaveBeenCalledWith('/management/agents');
    });

    it('navigates to agents list after successful creation', async () => {
      const user = userEvent.setup();
      const { createAgent } = require('@/utils/mutations/agents/create-agent');
      
      createAgent.mockResolvedValue({ id: 'new-agent-id' });
      
      renderWithQueryClient(<Agent mode="create" />);
      
      // Fill out and submit form
      await user.type(screen.getByLabelText(/Agent Name/), 'Test Agent');
      await user.type(screen.getByLabelText(/Subtitle/), 'Test Subtitle');
      await user.type(screen.getByLabelText(/Description/), 'Test Description');
      await user.type(screen.getByLabelText(/System Prompt/), 'Test System Prompt');
      
      const submitButton = screen.getByRole('button', { name: /Create Agent/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/management/agents');
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading state when fetching agent data', () => {
      const { getAgent } = require('@/utils/queries/agents/get-agent');
      getAgent.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderWithQueryClient(<Agent mode="edit" agentId="1" />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('shows submitting state during form submission', async () => {
      const user = userEvent.setup();
      const { createAgent } = require('@/utils/mutations/agents/create-agent');
      
      createAgent.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderWithQueryClient(<Agent mode="create" />);
      
      // Fill out and submit form
      await user.type(screen.getByLabelText(/Agent Name/), 'Test Agent');
      await user.type(screen.getByLabelText(/Subtitle/), 'Test Subtitle');
      await user.type(screen.getByLabelText(/Description/), 'Test Description');
      await user.type(screen.getByLabelText(/System Prompt/), 'Test System Prompt');
      
      const submitButton = screen.getByRole('button', { name: /Create Agent/ });
      await user.click(submitButton);
      
      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });
  });

  it('matches snapshot', () => {
    const { container } = renderWithQueryClient(<Agent mode="create" />);
    expect(container.firstChild).toMatchSnapshot();
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
 * The component has been simplified to remove Card wrapper and header elements,
 * focusing on direct form rendering with proper validation and API integration.
 */
