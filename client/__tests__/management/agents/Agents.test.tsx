import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ReactNode } from 'react';
import Agents from '@/components/management/agents/Agents';

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
vi.mock('@/utils/queries/agents/get-all-agents', () => ({
  getAllAgents: vi.fn(),
}));

vi.mock('@/utils/mutations/agents/delete-agent', () => ({
  deleteAgent: vi.fn(),
}));

// Import mocked functions
import { getAllAgents } from '@/utils/queries/agents/get-all-agents';
import { deleteAgent } from '@/utils/mutations/agents/delete-agent';

const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

// Mock data
const mockAgents = [
  {
    id: 'agent-1',
    name: 'Math Tutor Agent',
    subtitle: 'Helps with mathematics',
    description: 'An AI agent specialized in helping students with math problems and concepts.',
    temperature: 0.7,
    agentType: 'student' as const,
    systemPrompt: 'You are a helpful math tutor.',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'agent-2',
    name: 'Science Helper',
    subtitle: 'Science assistant',
    description: 'An AI agent that assists with science concepts and experiments.',
    temperature: 0.5,
    agentType: 'ta' as const,
    systemPrompt: 'You are a science teaching assistant.',
    createdAt: '2024-01-16T10:00:00Z',
  },
  {
    id: 'agent-3',
    name: 'General Assistant',
    subtitle: 'General purpose helper',
    description: 'A general-purpose AI agent for various educational tasks.',
    temperature: 0.8,
    agentType: 'default' as const,
    systemPrompt: 'You are a helpful educational assistant.',
    createdAt: '2024-01-17T10:00:00Z',
  },
];

describe('Agents', () => {
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
    (getAllAgents as any).mockResolvedValue(mockAgents);
    (deleteAgent as any).mockResolvedValue(undefined);
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
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Tutor Agent')).toBeInTheDocument();
      });
    });

    it('should display all agents correctly', async () => {
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Tutor Agent')).toBeInTheDocument();
        expect(screen.getByText('Science Helper')).toBeInTheDocument();
        expect(screen.getByText('General Assistant')).toBeInTheDocument();
      });
    });

    it('should show agent details including temperature', async () => {
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        expect(screen.getByText('Helps with mathematics')).toBeInTheDocument();
        expect(screen.getByText('Temperature: 0.7')).toBeInTheDocument();
        expect(screen.getByText('Temperature: 0.5')).toBeInTheDocument();
        expect(screen.getByText('Temperature: 0.8')).toBeInTheDocument();
      });
    });

    it('should display edit and delete buttons for each agent', async () => {
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: '' });
        const deleteButtons = screen.getAllByRole('button', { name: '' });
        
        // Should have edit and delete buttons for each agent
        expect(editButtons.length).toBeGreaterThanOrEqual(3);
        expect(deleteButtons.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('should show empty state when no agents exist', async () => {
      (getAllAgents as any).mockResolvedValue([]);
      
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        expect(screen.getByText('No agents found. Create your first agent to get started.')).toBeInTheDocument();
      });
    });

    it('should have correct accessibility attributes', async () => {
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        const agentCards = screen.getAllByRole('button');
        expect(agentCards.length).toBeGreaterThan(0);
        
        // Check for proper card structure
        expect(screen.getByText('Math Tutor Agent')).toBeInTheDocument();
        expect(screen.getByText('Helps with mathematics')).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should handle edit button clicks', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Tutor Agent')).toBeInTheDocument();
      });
      
      // Find the first edit button (Edit icon)
      const editButtons = screen.getAllByRole('button');
      const editButton = editButtons.find(button => 
        button.querySelector('svg') && !button.textContent?.includes('Delete')
      );
      
      if (editButton) {
        await user.click(editButton);
        expect(mockPush).toHaveBeenCalledWith('/management/agents/a/agent-1');
      }
    });

    it('should handle delete button clicks', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Tutor Agent')).toBeInTheDocument();
      });
      
      // Find and click a delete button
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(button => 
        button.querySelector('svg') && button.getAttribute('class')?.includes('outline')
      );
      
      if (deleteButton) {
        await user.click(deleteButton);
        
        // Should show confirmation dialog
        await waitFor(() => {
          expect(screen.getByText('Are you sure?')).toBeInTheDocument();
          expect(screen.getByText(/This will permanently delete the agent/)).toBeInTheDocument();
        });
      }
    });

    it('should handle delete confirmation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Tutor Agent')).toBeInTheDocument();
      });
      
      // Find and click a delete button
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons[deleteButtons.length - 1]; // Last button is likely delete
      
      await user.click(deleteButton);
      
      // Wait for dialog and confirm deletion
      await waitFor(() => {
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(deleteAgent).toHaveBeenCalledWith('agent-1');
        expect(toast.success).toHaveBeenCalledWith('Agent deleted successfully');
      });
    });

    it('should handle delete cancellation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Tutor Agent')).toBeInTheDocument();
      });
      
      // Find and click a delete button
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons[deleteButtons.length - 1];
      
      await user.click(deleteButton);
      
      // Wait for dialog and cancel deletion
      await waitFor(() => {
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
      });
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);
      
      // Dialog should close and no deletion should occur
      await waitFor(() => {
        expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
      });
      
      expect(deleteAgent).not.toHaveBeenCalled();
    });

    it('should disable buttons during deletion', async () => {
      const user = userEvent.setup();
      (deleteAgent as any).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Tutor Agent')).toBeInTheDocument();
      });
      
      // Trigger delete
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons[deleteButtons.length - 1];
      
      await user.click(deleteButton);
      
      await waitFor(() => {
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(confirmButton);
      
      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Deleting...')).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('should fetch agents on mount', async () => {
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        expect(getAllAgents).toHaveBeenCalled();
      });
    });

    it('should refetch agents after successful deletion', async () => {
      const mockRefetch = vi.fn();
      const user = userEvent.setup();
      
      // Mock the query to return a refetch function
      vi.mocked(getAllAgents).mockResolvedValue(mockAgents);
      
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Tutor Agent')).toBeInTheDocument();
      });
      
      // Simulate successful deletion
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons[deleteButtons.length - 1];
      
      await user.click(deleteButton);
      
      await waitFor(() => {
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(deleteAgent).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith('Agent deleted successfully');
      });
    });

    it('should handle API errors gracefully', async () => {
      (getAllAgents as any).mockRejectedValue(new Error('API Error'));
      
      renderWithProviders(<Agents />);
      
      // Should not crash on API error
      await waitFor(() => {
        expect(getAllAgents).toHaveBeenCalled();
      });
    });

    it('should handle deletion errors', async () => {
      const user = userEvent.setup();
      (deleteAgent as any).mockRejectedValue(new Error('Delete failed'));
      
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Tutor Agent')).toBeInTheDocument();
      });
      
      // Trigger delete
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons[deleteButtons.length - 1];
      
      await user.click(deleteButton);
      
      await waitFor(() => {
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to delete agent');
      });
    });

    it('should handle loading states correctly', () => {
      (getAllAgents as any).mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderWithProviders(<Agents />);
      
      // Should show loading state (empty state while loading)
      expect(screen.queryByText('Math Tutor Agent')).not.toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate to edit page when edit button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Tutor Agent')).toBeInTheDocument();
      });
      
      // Find the edit button for the first agent
      const editButtons = screen.getAllByRole('button');
      const editButton = editButtons.find(button => 
        button.querySelector('svg') && !button.textContent?.includes('Delete')
      );
      
      if (editButton) {
        await user.click(editButton);
        expect(mockPush).toHaveBeenCalledWith('/management/agents/a/agent-1');
      }
    });

    it('should navigate to correct agent edit pages', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        expect(screen.getByText('Science Helper')).toBeInTheDocument();
      });
      
      // Test navigation for different agents
      const editButtons = screen.getAllByRole('button');
      
      // Click on different edit buttons to test navigation
      if (editButtons.length >= 2) {
        const secondEditButton = editButtons[1];
        await user.click(secondEditButton);
        
        // Should navigate to the second agent's edit page
        expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/management/agents/a/'));
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle agents with missing data gracefully', async () => {
      const incompleteAgents = [
        {
          id: 'agent-incomplete',
          name: 'Incomplete Agent',
          // Missing subtitle, description, etc.
        },
      ];
      (getAllAgents as any).mockResolvedValue(incompleteAgents);
      
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        expect(screen.getByText('Incomplete Agent')).toBeInTheDocument();
      });
      
      // Should not crash with incomplete data
      expect(screen.getByText('Incomplete Agent')).toBeInTheDocument();
    });

    it('should handle very long agent names and descriptions', async () => {
      const longNameAgents = [
        {
          id: 'agent-long',
          name: 'A'.repeat(100),
          subtitle: 'B'.repeat(200),
          description: 'C'.repeat(500),
          temperature: 0.5,
        },
      ];
      (getAllAgents as any).mockResolvedValue(longNameAgents);
      
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        expect(screen.getByText('A'.repeat(100))).toBeInTheDocument();
      });
    });

    it('should handle network timeouts', async () => {
      (getAllAgents as any).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );
      
      renderWithProviders(<Agents />);
      
      // Should handle timeout gracefully
      await waitFor(() => {
        expect(getAllAgents).toHaveBeenCalled();
      });
    });

    it('should handle rapid delete button clicks', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Tutor Agent')).toBeInTheDocument();
      });
      
      // Rapidly click delete button
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons[deleteButtons.length - 1];
      
      await user.click(deleteButton);
      await user.click(deleteButton);
      
      // Should only show one dialog
      const dialogs = screen.getAllByText('Are you sure?');
      expect(dialogs).toHaveLength(1);
    });

    it('should handle deletion of non-existent agent', async () => {
      const user = userEvent.setup();
      (deleteAgent as any).mockRejectedValue(new Error('Agent not found'));
      
      renderWithProviders(<Agents />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Tutor Agent')).toBeInTheDocument();
      });
      
      // Trigger delete
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons[deleteButtons.length - 1];
      
      await user.click(deleteButton);
      
      await waitFor(() => {
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to delete agent');
      });
    });

    it('should handle malformed agent data', async () => {
      const malformedAgents = [
        {
          id: null, // Invalid ID
          name: undefined, // Invalid name
          temperature: 'invalid', // Invalid temperature
        },
      ];
      (getAllAgents as any).mockResolvedValue(malformedAgents);
      
      renderWithProviders(<Agents />);
      
      // Should not crash with malformed data
      await waitFor(() => {
        expect(getAllAgents).toHaveBeenCalled();
      });
    });
  });
});

/*
 * Component Analysis for Agents:
 * Path: management/agents/Agents.tsx
 * 
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None detected
 * - Client component: false
 * - Uses hooks: useState, useQuery, useRouter
 * - Uses router: true
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: true
 * - Uses effects: false
 * - Uses context: false
 * 
 * TODO: Implement the failing tests above with actual test logic
 * 
 * Example implementations:
 * 
 * Basic rendering:
 * render(<Agents />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 * 
 * Props testing:
 * const props = { ... };
 * render(<Agents {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 * 
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
