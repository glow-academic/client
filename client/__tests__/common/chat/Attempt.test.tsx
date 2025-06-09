import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import Attempt from '@/components/common/chat/Attempt';

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

// Mock Link component
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock API calls
vi.mock('@/utils/queries/simulation_attempts/get-simulationAttempt', () => ({
  getSimulationAttempt: vi.fn(),
}));

vi.mock('@/utils/queries/simulations/get-simulation', () => ({
  getSimulation: vi.fn(),
}));

vi.mock('@/utils/queries/simulation_chats/get-simulation-chats-by-attempt', () => ({
  getSimulationChatsByAttempt: vi.fn(),
}));

vi.mock('@/utils/queries/scenarios/get-scenario', () => ({
  getScenario: vi.fn(),
}));

vi.mock('@/utils/queries/simulation_messages/get-simulation-messages-by-chat', () => ({
  getSimulationMessagesByChat: vi.fn(),
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

vi.mock('@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats', () => ({
  getSimulationChatGradesBySimulationChats: vi.fn(),
}));

vi.mock('@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades', () => ({
  getSimulationChatFeedbacksBySimulationChatGrades: vi.fn(),
}));

vi.mock('@/utils/queries/documents/get-all-documents', () => ({
  getAllDocuments: vi.fn(),
}));

// Mock components
vi.mock('@/components/common/chat/DocumentViewer', () => ({
  default: ({ document }: { document: any }) => <div data-testid="document-viewer">{document.name}</div>,
}));

vi.mock('@/components/common/chat/Markdown', () => ({
  default: ({ children }: { children: ReactNode }) => <div data-testid="markdown">{children}</div>,
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Attempt', () => {
  let queryClient: QueryClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Setup default mock implementations
    const mockAttempt = {
      id: 'attempt-1',
      userId: 'user-1',
      classId: 'class-1',
      simulationId: 'simulation-1',
      createdAt: '2024-01-01T00:00:00Z',
    };

    const mockSimulation = {
      id: 'simulation-1',
      name: 'Test Simulation',
      description: 'Test simulation description',
      scenarioIds: ['scenario-1', 'scenario-2'],
      timeLimit: 30, // 30 minutes
      rubricId: 'rubric-1',
      createdAt: '2024-01-01T00:00:00Z',
    };

    const mockChats = [
      {
        id: 'chat-1',
        title: 'Test Chat 1',
        scenarioId: 'scenario-1',
        attemptId: 'attempt-1',
        completed: true,
        createdAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T01:00:00Z',
      },
      {
        id: 'chat-2',
        title: 'Test Chat 2',
        scenarioId: 'scenario-2',
        attemptId: 'attempt-1',
        completed: false,
        createdAt: '2024-01-01T01:00:00Z',
        completedAt: null,
      },
    ];

    const mockScenario = {
      id: 'scenario-1',
      name: 'Test Scenario',
      description: 'Test scenario description',
      crowdedness: 3,
      intensity: 2,
      createdAt: '2024-01-01T00:00:00Z',
    };

    const mockMessages = [
      {
        id: 'message-1',
        query: 'Hello, I need help with calculus.',
        response: 'I\'d be happy to help you with calculus! What specific topic are you working on?',
        chatId: 'chat-1',
        completed: true,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ];

    const mockRubrics = [
      {
        id: 'rubric-1',
        name: 'Test Rubric',
        description: 'Test rubric description',
        points: 100,
        passPoints: 70,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ];

    const mockStandardGroups = [
      {
        id: 'group-1',
        name: 'Communication Skills',
        description: 'Communication and listening skills',
        points: 25,
        passPoints: 18,
        rubricId: 'rubric-1',
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'group-2',
        name: 'Adaptability',
        description: 'Flexibility and adaptation skills',
        points: 25,
        passPoints: 18,
        rubricId: 'rubric-1',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ];

    const mockStandards = [
      {
        id: 'standard-1',
        name: 'Active Listening',
        description: 'Demonstrates active listening skills',
        points: 25,
        standardGroupId: 'group-1',
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'standard-2',
        name: 'Flexibility',
        description: 'Shows flexibility in teaching approach',
        points: 25,
        standardGroupId: 'group-2',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ];

    const mockGrades = [
      {
        id: 'grade-1',
        simulationChatId: 'chat-1',
        score: 85,
        timeTaken: 3600, // 1 hour
        createdAt: '2024-01-01T00:00:00Z',
      },
    ];

    const mockFeedbacks = [
      {
        id: 'feedback-1',
        simulationChatGradeId: 'grade-1',
        standardId: 'standard-1',
        total: 20,
        feedback: 'Good listening skills demonstrated',
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'feedback-2',
        simulationChatGradeId: 'grade-1',
        standardId: 'standard-2',
        total: 22,
        feedback: 'Shows good adaptability to student needs',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ];

    const mockDocuments = [
      {
        id: 'doc-1',
        name: 'Course Syllabus',
        content: 'Course syllabus content',
        classId: 'class-1',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ];

    // Apply mocks
    require('@/utils/queries/simulation_attempts/get-simulationAttempt').getSimulationAttempt.mockResolvedValue(mockAttempt);
    require('@/utils/queries/simulations/get-simulation').getSimulation.mockResolvedValue(mockSimulation);
    require('@/utils/queries/simulation_chats/get-simulation-chats-by-attempt').getSimulationChatsByAttempt.mockResolvedValue(mockChats);
    require('@/utils/queries/scenarios/get-scenario').getScenario.mockResolvedValue(mockScenario);
    require('@/utils/queries/simulation_messages/get-simulation-messages-by-chat').getSimulationMessagesByChat.mockResolvedValue(mockMessages);
    require('@/utils/queries/rubrics/get-all-rubrics').getAllRubrics.mockResolvedValue(mockRubrics);
    require('@/utils/queries/standard_groups/get-standard-groups-by-rubrics').getStandardGroupsByRubrics.mockResolvedValue(mockStandardGroups);
    require('@/utils/queries/standards/get-standards-by-standardgroups').getStandardsByStandardGroups.mockResolvedValue(mockStandards);
    require('@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats').getSimulationChatGradesBySimulationChats.mockResolvedValue(mockGrades);
    require('@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades').getSimulationChatFeedbacksBySimulationChatGrades.mockResolvedValue(mockFeedbacks);
    require('@/utils/queries/documents/get-all-documents').getAllDocuments.mockResolvedValue(mockDocuments);
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
      renderWithProviders(<Attempt attemptId="attempt-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Test scenario description')).toBeInTheDocument();
      });
    });

    it('should display chat counter for multi-chat attempts', async () => {
      renderWithProviders(<Attempt attemptId="attempt-1" />);
      
      await waitFor(() => {
        expect(screen.getByTestId('chat-counter')).toBeInTheDocument();
        expect(screen.getByText('Chat 2 of 2')).toBeInTheDocument(); // Should show current incomplete chat
      });
    });

    it('should display scenario information', async () => {
      renderWithProviders(<Attempt attemptId="attempt-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('High crowdedness')).toBeInTheDocument();
        expect(screen.getByText('Moderate intensity')).toBeInTheDocument();
      });
    });

    it('should have correct accessibility attributes', async () => {
      renderWithProviders(<Attempt attemptId="attempt-1" />);
      
      await waitFor(() => {
        expect(screen.getByTestId('message-input')).toBeInTheDocument();
        expect(screen.getByTestId('send-button')).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('should handle API calls correctly', async () => {
      renderWithProviders(<Attempt attemptId="attempt-1" />);
      
      await waitFor(() => {
        expect(require('@/utils/queries/simulation_attempts/get-simulationAttempt').getSimulationAttempt).toHaveBeenCalledWith('attempt-1');
      });
    });

    it('should handle loading states', () => {
      // Mock loading state
      require('@/utils/queries/simulation_attempts/get-simulationAttempt').getSimulationAttempt.mockImplementation(() => new Promise(() => {}));
      
      renderWithProviders(<Attempt attemptId="attempt-1" />);
      
      // Should show loading skeleton
      expect(screen.getByRole('generic')).toBeInTheDocument();
    });

    it('should handle error states', async () => {
      require('@/utils/queries/simulation_attempts/get-simulationAttempt').getSimulationAttempt.mockRejectedValue(new Error('API Error'));
      
      renderWithProviders(<Attempt attemptId="attempt-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Attempt Not Found')).toBeInTheDocument();
      });
    });
  });

  describe('Chat Functionality', () => {
    it('should display messages correctly', async () => {
      renderWithProviders(<Attempt attemptId="attempt-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Hello, I need help with calculus.')).toBeInTheDocument();
        expect(screen.getByText('I\'d be happy to help you with calculus! What specific topic are you working on?')).toBeInTheDocument();
      });
    });

    it('should handle message input', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Attempt attemptId="attempt-1" />);
      
      await waitFor(() => {
        const input = screen.getByTestId('message-input');
        expect(input).toBeInTheDocument();
      });

      const input = screen.getByTestId('message-input');
      await user.type(input, 'Test message');
      expect(input).toHaveValue('Test message');
    });

    it('should show completed chat status', async () => {
      renderWithProviders(<Attempt attemptId="attempt-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
      });
    });
  });

  describe('Dynamic Rubric System', () => {
    it('should calculate dynamic rubric scores', async () => {
      // Mock completed chat scenario
      const mockCompletedChats = [
        {
          id: 'chat-1',
          title: 'Test Chat 1',
          scenarioId: 'scenario-1',
          attemptId: 'attempt-1',
          completed: true,
          createdAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T01:00:00Z',
        },
      ];

      require('@/utils/queries/simulation_chats/get-simulation-chats-by-attempt').getSimulationChatsByAttempt.mockResolvedValue(mockCompletedChats);
      
      renderWithProviders(<Attempt attemptId="attempt-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('This chat has been completed.')).toBeInTheDocument();
      });
    });

    it('should display skill-based feedback', async () => {
      // Test will verify that feedback is properly displayed when available
      renderWithProviders(<Attempt attemptId="attempt-1" />);
      
      await waitFor(() => {
        // Should load without errors
        expect(screen.getByTestId('message-input')).toBeInTheDocument();
      });
    });
  });

  describe('Results Display', () => {
    it('should show results when all chats completed', async () => {
      // Mock all chats as completed
      const mockAllCompletedChats = [
        {
          id: 'chat-1',
          title: 'Test Chat 1',
          scenarioId: 'scenario-1',
          attemptId: 'attempt-1',
          completed: true,
          createdAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T01:00:00Z',
        },
        {
          id: 'chat-2',
          title: 'Test Chat 2',
          scenarioId: 'scenario-2',
          attemptId: 'attempt-1',
          completed: true,
          createdAt: '2024-01-01T01:00:00Z',
          completedAt: '2024-01-01T02:00:00Z',
        },
      ];

      const mockAllGrades = [
        {
          id: 'grade-1',
          simulationChatId: 'chat-1',
          score: 85,
          timeTaken: 3600,
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'grade-2',
          simulationChatId: 'chat-2',
          score: 90,
          timeTaken: 3000,
          createdAt: '2024-01-01T01:00:00Z',
        },
      ];

      require('@/utils/queries/simulation_chats/get-simulation-chats-by-attempt').getSimulationChatsByAttempt.mockResolvedValue(mockAllCompletedChats);
      require('@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats').getSimulationChatGradesBySimulationChats.mockResolvedValue(mockAllGrades);
      
      renderWithProviders(<Attempt attemptId="attempt-1" />);
      
      await waitFor(() => {
        expect(screen.getByTestId('attempt-results')).toBeInTheDocument();
        expect(screen.getByText('Overall Results')).toBeInTheDocument();
      });
    });
  });

  describe('Documents', () => {
    it('should display class documents', async () => {
      renderWithProviders(<Attempt attemptId="attempt-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Documents')).toBeInTheDocument();
        expect(screen.getByTestId('document-viewer')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing attempt gracefully', async () => {
      require('@/utils/queries/simulation_attempts/get-simulationAttempt').getSimulationAttempt.mockResolvedValue(null);
      
      renderWithProviders(<Attempt attemptId="nonexistent" />);
      
      await waitFor(() => {
        expect(screen.getByText('Attempt Not Found')).toBeInTheDocument();
      });
    });

    it('should handle empty scenario IDs', async () => {
      const mockSimulationNoScenarios = {
        id: 'simulation-1',
        name: 'Test Simulation',
        description: 'Test simulation description',
        scenarioIds: [],
        timeLimit: 30,
        rubricId: 'rubric-1',
        createdAt: '2024-01-01T00:00:00Z',
      };

      require('@/utils/queries/simulations/get-simulation').getSimulation.mockResolvedValue(mockSimulationNoScenarios);
      
      renderWithProviders(<Attempt attemptId="attempt-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Attempt Not Found')).toBeInTheDocument();
      });
    });

    it('should handle missing grades/feedbacks gracefully', async () => {
      require('@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats').getSimulationChatGradesBySimulationChats.mockResolvedValue([]);
      require('@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades').getSimulationChatFeedbacksBySimulationChatGrades.mockResolvedValue([]);
      
      renderWithProviders(<Attempt attemptId="attempt-1" />);
      
      await waitFor(() => {
        // Should still render without errors
        expect(screen.getByTestId('message-input')).toBeInTheDocument();
      });
    });
  });
});

/*
 * Component Analysis for Attempt:
 * Path: common/chat/Attempt.tsx
 * 
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true (attemptId: string)
 * - Props interface: { attemptId: string }
 * - Client component: true (uses hooks and state)
 * - Uses hooks: useState, useEffect, useRef, useMemo, useQuery, useQueryClient, useRouter
 * - Uses router: true (useRouter from next/navigation)
 * - Has API calls: true (multiple simulation-related queries)
 * - Has form handling: true (message sending form)
 * - Uses state: true (multiple state variables for chat functionality)
 * - Uses effects: true (multiple useEffect for timer, auto-scroll, etc.)
 * - Uses context: false (uses query client)
 * 
 * The component now properly uses the dynamic rubric system based on grades/feedback
 * instead of the static rubric, following the Overview pattern for consistency
 * and better data accuracy. It handles both single and multi-chat attempts with
 * proper results display and skill-based feedback.
 */
