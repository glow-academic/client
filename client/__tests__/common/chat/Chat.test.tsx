import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Chat from '@/components/common/chat/Chat';

// Mock external dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/utils/queries/simulation_chats/get-simulationChat');
vi.mock('@/utils/queries/simulation_attempts/get-simulationAttempt');
vi.mock('@/utils/queries/scenarios/get-scenario');
vi.mock('@/utils/queries/simulation_messages/get-simulation-messages-by-chat');
vi.mock('@/utils/queries/simulations/get-simulation');
vi.mock('@/utils/queries/rubrics/get-all-rubrics');
vi.mock('@/utils/queries/standard_groups/get-standard-groups-by-rubric');
vi.mock('@/utils/queries/standards/get-standards-by-standardgroups');
vi.mock('@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchat');
vi.mock('@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades');

const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
};

// Mock data
const mockChat = {
  id: 'chat-1',
  title: 'Test Chat',
  scenarioId: 'scenario-1',
  attemptId: 'attempt-1',
  completed: false,
  createdAt: '2024-01-01T00:00:00Z',
};

const mockCompletedChat = {
  ...mockChat,
  completed: true,
  completedAt: '2024-01-01T01:00:00Z',
};

const mockAttempt = {
  id: 'attempt-1',
  simulationId: 'simulation-1',
  classId: 'class-1',
};

const mockScenario = {
  id: 'scenario-1',
  description: 'Test Scenario',
  crowdedness: 3,
  intensity: 4,
};

const mockSimulation = {
  id: 'simulation-1',
  rubricId: 'rubric-1',
  scenarioIds: ['scenario-1'],
};

const mockStandardGroups = [
  { id: 'group-1', name: 'Communication', rubricId: 'rubric-1' },
  { id: 'group-2', name: 'Problem Solving', rubricId: 'rubric-1' },
];

const mockStandards = [
  { id: 'standard-1', standardGroupId: 'group-1', points: 10 },
  { id: 'standard-2', standardGroupId: 'group-2', points: 15 },
];

const mockGrades = [
  { id: 'grade-1', simulationChatId: 'chat-1', score: 85, timeTaken: 1800 },
];

const mockFeedbacks = [
  { id: 'feedback-1', simulationChatGradeId: 'grade-1', standardId: 'standard-1', total: 8, feedback: 'Good communication' },
  { id: 'feedback-2', simulationChatGradeId: 'grade-1', standardId: 'standard-2', total: 12, feedback: 'Excellent problem solving' },
];

const mockMessages = [
  {
    id: 'msg-1',
    query: 'Hello, how can I help?',
    response: 'I need assistance with this issue.',
    createdAt: '2024-01-01T00:30:00Z',
    chatId: 'chat-1',
    completed: false,
  },
];

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    
    // Mock successful queries by default
    vi.doMock('@/utils/queries/simulation_chats/get-simulationChat', () => ({
      getSimulationChat: vi.fn().mockResolvedValue(mockChat),
    }));
    
    vi.doMock('@/utils/queries/simulation_attempts/get-simulationAttempt', () => ({
      getSimulationAttempt: vi.fn().mockResolvedValue(mockAttempt),
    }));
    
    vi.doMock('@/utils/queries/scenarios/get-scenario', () => ({
      getScenario: vi.fn().mockResolvedValue(mockScenario),
    }));
    
    vi.doMock('@/utils/queries/simulations/get-simulation', () => ({
      getSimulation: vi.fn().mockResolvedValue(mockSimulation),
    }));
    
    vi.doMock('@/utils/queries/simulation_messages/get-simulation-messages-by-chat', () => ({
      getSimulationMessagesByChat: vi.fn().mockResolvedValue(mockMessages),
    }));
    
    vi.doMock('@/utils/queries/standard_groups/get-standard-groups-by-rubric', () => ({
      getStandardGroupsByRubric: vi.fn().mockResolvedValue(mockStandardGroups),
    }));
    
    vi.doMock('@/utils/queries/standards/get-standards-by-standardgroups', () => ({
      getStandardsByStandardGroups: vi.fn().mockResolvedValue(mockStandards),
    }));
    
    vi.doMock('@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchat', () => ({
      getSimulationChatGradesBySimulationChat: vi.fn().mockResolvedValue(mockGrades),
    }));
    
    vi.doMock('@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades', () => ({
      getSimulationChatFeedbacksBySimulationChatGrades: vi.fn().mockResolvedValue(mockFeedbacks),
    }));
  });

  describe('Rendering', () => {
    it('should render loading state initially', () => {
      render(<Chat chatId="chat-1" />, { wrapper: createWrapper() });
      
      expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
    });

    it('should render chat not found when chat does not exist', async () => {
      vi.doMock('@/utils/queries/simulation_chats/get-simulationChat', () => ({
        getSimulationChat: vi.fn().mockResolvedValue(null),
      }));
      
      render(<Chat chatId="nonexistent" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Chat Not Found')).toBeInTheDocument();
      });
    });

    it('should render chat in progress message for incomplete chats', async () => {
      render(<Chat chatId="chat-1" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Chat In Progress')).toBeInTheDocument();
      });
    });

    it('should have correct accessibility attributes', async () => {
      render(<Chat chatId="chat-1" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        const chatContainer = screen.getByRole('main');
        expect(chatContainer).toHaveAttribute('aria-label', 'Chat conversation');
      });
    });
  });

  describe('Dynamic Rubric Results', () => {
    it('should display dynamic rubric results for completed chats', async () => {
      vi.doMock('@/utils/queries/simulation_chats/get-simulationChat', () => ({
        getSimulationChat: vi.fn().mockResolvedValue(mockCompletedChat),
      }));
      
      render(<Chat chatId="chat-1" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Performance Results')).toBeInTheDocument();
        expect(screen.getByText('85/25')).toBeInTheDocument(); // Score/Total
        expect(screen.getByText('Communication')).toBeInTheDocument();
        expect(screen.getByText('Problem Solving')).toBeInTheDocument();
      });
    });

    it('should show passed status for high scores', async () => {
      vi.doMock('@/utils/queries/simulation_chats/get-simulationChat', () => ({
        getSimulationChat: vi.fn().mockResolvedValue(mockCompletedChat),
      }));
      
      render(<Chat chatId="chat-1" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        const resultsCard = screen.getByText('Performance Results').closest('.bg-green-100');
        expect(resultsCard).toBeInTheDocument();
      });
    });

    it('should show failed status for low scores', async () => {
      const lowScoreGrades = [
        { ...mockGrades[0], score: 10 }, // Below 70% threshold
      ];
      
      vi.doMock('@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchat', () => ({
        getSimulationChatGradesBySimulationChat: vi.fn().mockResolvedValue(lowScoreGrades),
      }));
      
      vi.doMock('@/utils/queries/simulation_chats/get-simulationChat', () => ({
        getSimulationChat: vi.fn().mockResolvedValue(mockCompletedChat),
      }));
      
      render(<Chat chatId="chat-1" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        const resultsCard = screen.getByText('Performance Results').closest('.bg-red-100');
        expect(resultsCard).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to attempt when continue button is clicked', async () => {
      const user = userEvent.setup();
      render(<Chat chatId="chat-1" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        const continueButton = screen.getByText('Continue in Attempt');
        expect(continueButton).toBeInTheDocument();
      });
      
      const continueButton = screen.getByText('Continue in Attempt');
      await user.click(continueButton);
      
      expect(mockPush).toHaveBeenCalledWith('/a/attempt-1');
    });

    it('should navigate home when return button is clicked', async () => {
      const user = userEvent.setup();
      vi.doMock('@/utils/queries/simulation_chats/get-simulationChat', () => ({
        getSimulationChat: vi.fn().mockResolvedValue(null),
      }));
      
      render(<Chat chatId="nonexistent" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        const returnButton = screen.getByText('Return Home');
        expect(returnButton).toBeInTheDocument();
      });
      
      const returnButton = screen.getByText('Return Home');
      await user.click(returnButton);
      
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('Messages Display', () => {
    it('should display chat messages correctly', async () => {
      vi.doMock('@/utils/queries/simulation_chats/get-simulationChat', () => ({
        getSimulationChat: vi.fn().mockResolvedValue(mockCompletedChat),
      }));
      
      render(<Chat chatId="chat-1" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Hello, how can I help?')).toBeInTheDocument();
        expect(screen.getByText('I need assistance with this issue.')).toBeInTheDocument();
      });
    });

    it('should show empty state when no messages exist', async () => {
      vi.doMock('@/utils/queries/simulation_messages/get-simulation-messages-by-chat', () => ({
        getSimulationMessagesByChat: vi.fn().mockResolvedValue([]),
      }));
      
      render(<Chat chatId="chat-1" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('No messages in this chat yet.')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing grades gracefully', async () => {
      vi.doMock('@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchat', () => ({
        getSimulationChatGradesBySimulationChat: vi.fn().mockResolvedValue([]),
      }));
      
      vi.doMock('@/utils/queries/simulation_chats/get-simulationChat', () => ({
        getSimulationChat: vi.fn().mockResolvedValue(mockCompletedChat),
      }));
      
      render(<Chat chatId="chat-1" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        // Should not show performance results without grades
        expect(screen.queryByText('Performance Results')).not.toBeInTheDocument();
      });
    });

    it('should handle missing feedbacks gracefully', async () => {
      vi.doMock('@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades', () => ({
        getSimulationChatFeedbacksBySimulationChatGrades: vi.fn().mockResolvedValue([]),
      }));
      
      vi.doMock('@/utils/queries/simulation_chats/get-simulationChat', () => ({
        getSimulationChat: vi.fn().mockResolvedValue(mockCompletedChat),
      }));
      
      render(<Chat chatId="chat-1" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        // Should not show performance results without feedbacks
        expect(screen.queryByText('Performance Results')).not.toBeInTheDocument();
      });
    });

    it('should handle query errors gracefully', async () => {
      vi.doMock('@/utils/queries/simulation_chats/get-simulationChat', () => ({
        getSimulationChat: vi.fn().mockRejectedValue(new Error('Network error')),
      }));
      
      render(<Chat chatId="chat-1" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Chat Not Found')).toBeInTheDocument();
      });
    });
  });
});

/*
 * Component Analysis for Chat:
 * Path: common/chat/Chat.tsx
 * 
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true (chatId: string)
 * - Props interface: { chatId: string }
 * - Client component: true
 * - Uses hooks: useQuery, useState, useRef, useEffect, useMemo
 * - Uses router: true
 * - Has API calls: true (multiple queries)
 * - Has form handling: false
 * - Uses state: true
 * - Uses effects: true
 * - Uses context: false
 * 
 * Key functionality:
 * - Displays chat messages and conversation history
 * - Shows dynamic rubric results based on grades/feedback
 * - Handles navigation between chat and attempt pages
 * - Calculates performance metrics from actual data
 * - Supports both completed and in-progress chats
 */
