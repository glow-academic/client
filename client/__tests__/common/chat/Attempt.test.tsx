/**
 * Attempt.test.tsx
 * Test suite for the Attempt component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Attempt from '@/components/common/chat/Attempt';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock all the query functions
vi.mock('@/utils/user/get-user-by-email', () => ({
  getUserByEmail: vi.fn(),
}));

vi.mock('@/utils/queries/profiles/get-profiles-by-user', () => ({
  getProfilesByUser: vi.fn(),
}));

vi.mock('@/utils/queries/simulation_attempts/get-simulation-attempt', () => ({
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

vi.mock('@/utils/queries/classes/get-class', () => ({
  getClass: vi.fn(),
}));

vi.mock('@/utils/queries/simulation_messages/get-simulation-messages-by-chat', () => ({
  getSimulationMessagesByChat: vi.fn(),
}));

vi.mock('@/utils/queries/documents/get-all-documents', () => ({
  getAllDocuments: vi.fn(),
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

// Mock DocumentViewer component
vi.mock('@/components/common/chat/DocumentViewer', () => ({
  default: ({ document }: { document: any }) => (
    <div data-testid="document-viewer">Document: {document.name}</div>
  ),
}));

// Mock Markdown component
vi.mock('@/components/common/chat/Markdown', () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

// Mock TableRubric component
vi.mock('@/components/common/rubric/TableRubric', () => ({
  default: ({ rubricId, simulationChatId }: { rubricId: string; simulationChatId: string }) => (
    <div data-testid="table-rubric">Rubric: {rubricId} for Chat: {simulationChatId}</div>
  ),
}));

// Mock data
const mockUser = {
  id: 'user1',
  email: 'redacted@purdue.edu',
};

const mockProfile = {
  id: 'profile1',
  firstName: 'John',
  lastName: 'Doe',
  alias: 'jdoe',
  role: 'ta',
};

const mockAttempt = {
  id: 'attempt1',
  simulationId: 'simulation1',
  profileId: 'profile1',
  createdAt: new Date().toISOString(),
};

const mockSimulation = {
  id: 'simulation1',
  name: 'Test Simulation',
  scenarioIds: ['scenario1', 'scenario2'],
  timeLimit: 30, // 30 minutes
  rubricId: 'rubric1',
};

const mockChats = [
  {
    id: 'chat1',
    scenarioId: 'scenario1',
    attemptId: 'attempt1',
    title: 'Chat 1',
    completed: false,
  },
  {
    id: 'chat2',
    scenarioId: 'scenario2',
    attemptId: 'attempt1',
    title: 'Chat 2',
    completed: false,
  },
];

const mockScenario = {
  id: 'scenario1',
  name: 'Test Scenario',
  description: 'A test scenario for TAs',
  classId: 'class1',
};

const mockClass = {
  id: 'class1',
  name: 'CS 180',
  classCode: 'CS180',
  description: 'Computer Science Course',
};

const mockMessages = [
  {
    id: 'msg1',
    query: 'Hello, how can I help you?',
    response: 'Hi! I need help with my assignment.',
    createdAt: new Date().toISOString(),
    chatId: 'chat1',
    completed: true,
  },
];

const mockDocuments = [
  {
    id: 'doc1',
    name: 'Course Syllabus',
    classId: 'class1',
    type: 'pdf',
    content: 'Syllabus content',
  },
];

const mockRubrics = [
  {
    id: 'rubric1',
    name: 'TA Performance Rubric',
    points: 100,
    passPoints: 70,
  },
];

const mockStandardGroups = [
  {
    id: 'group1',
    name: 'Communication',
    shortName: 'Comm',
    rubricId: 'rubric1',
    points: 25,
  },
];

const mockStandards = [
  {
    id: 'standard1',
    name: 'Clear Communication',
    standardGroupId: 'group1',
    points: 5,
  },
];

const mockGrades = [
  {
    id: 'grade1',
    simulationChatId: 'chat1',
    rubricId: 'rubric1',
    score: 85,
    passed: true,
    timeTaken: 300, // 5 minutes
    createdAt: new Date().toISOString(),
  },
];

const mockFeedbacks = [
  {
    id: 'feedback1',
    simulationChatGradeId: 'grade1',
    standardId: 'standard1',
    total: 4,
    feedback: 'Good communication skills',
  },
];

describe('Attempt Component', () => {
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

    (useSession as any).mockReturnValue({
      data: { user: { email: 'redacted@purdue.edu' } },
    });

    // Mock all query functions
    const { getUserByEmail } = require('@/utils/user/get-user-by-email');
    const { getProfilesByUser } = require('@/utils/queries/profiles/get-profiles-by-user');
    const { getSimulationAttempt } = require('@/utils/queries/simulation_attempts/get-simulation-attempt');
    const { getSimulation } = require('@/utils/queries/simulations/get-simulation');
    const { getSimulationChatsByAttempt } = require('@/utils/queries/simulation_chats/get-simulation-chats-by-attempt');
    const { getScenario } = require('@/utils/queries/scenarios/get-scenario');
    const { getClass } = require('@/utils/queries/classes/get-class');
    const { getSimulationMessagesByChat } = require('@/utils/queries/simulation_messages/get-simulation-messages-by-chat');
    const { getAllDocuments } = require('@/utils/queries/documents/get-all-documents');
    const { getAllRubrics } = require('@/utils/queries/rubrics/get-all-rubrics');
    const { getStandardGroupsByRubrics } = require('@/utils/queries/standard_groups/get-standard-groups-by-rubrics');
    const { getStandardsByStandardGroups } = require('@/utils/queries/standards/get-standards-by-standardgroups');
    const { getSimulationChatGradesBySimulationChats } = require('@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats');
    const { getSimulationChatFeedbacksBySimulationChatGrades } = require('@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades');

    getUserByEmail.mockResolvedValue(mockUser);
    getProfilesByUser.mockResolvedValue([mockProfile]);
    getSimulationAttempt.mockResolvedValue(mockAttempt);
    getSimulation.mockResolvedValue(mockSimulation);
    getSimulationChatsByAttempt.mockResolvedValue(mockChats);
    getScenario.mockResolvedValue(mockScenario);
    getClass.mockResolvedValue(mockClass);
    getSimulationMessagesByChat.mockResolvedValue(mockMessages);
    getAllDocuments.mockResolvedValue(mockDocuments);
    getAllRubrics.mockResolvedValue(mockRubrics);
    getStandardGroupsByRubrics.mockResolvedValue(mockStandardGroups);
    getStandardsByStandardGroups.mockResolvedValue(mockStandards);
    getSimulationChatGradesBySimulationChats.mockResolvedValue(mockGrades);
    getSimulationChatFeedbacksBySimulationChatGrades.mockResolvedValue(mockFeedbacks);

    // Mock fetch for message sending
    global.fetch = vi.fn();
  });

  const renderAttempt = (attemptId = 'attempt1') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Attempt attemptId={attemptId} />
      </QueryClientProvider>
    );
  };

  it('renders loading state initially', () => {
    renderAttempt();
    expect(screen.getByText('Loading performance analytics...')).toBeInTheDocument();
  });

  it('displays attempt information when loaded', async () => {
    renderAttempt();

    await waitFor(() => {
      expect(screen.getByText('A test scenario for TAs')).toBeInTheDocument();
    });

    expect(screen.getByTestId('chat-counter')).toHaveTextContent('Chat 1 of 2');
  });

  it('displays timer correctly', async () => {
    renderAttempt();

    await waitFor(() => {
      expect(screen.getByTestId('timer')).toBeInTheDocument();
    });
  });

  it('allows sending messages', async () => {
    const mockResponse = {
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"text": "Hello"}\n\n'),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"done": true}\n\n'),
            })
            .mockResolvedValueOnce({ done: true }),
        }),
      },
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    renderAttempt();

    await waitFor(() => {
      expect(screen.getByTestId('message-input')).toBeInTheDocument();
    });

    const messageInput = screen.getByTestId('message-input');
    const sendButton = screen.getByTestId('send-button');

    fireEvent.change(messageInput, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/simulations/message'),
      expect.objectContaining({
        method: 'POST',
        headers: { Accept: 'text/event-stream' },
      })
    );
  });

  it('displays starter prompts when no messages', async () => {
    const { getSimulationMessagesByChat } = require('@/utils/queries/simulation_messages/get-simulation-messages-by-chat');
    getSimulationMessagesByChat.mockResolvedValue([]);

    renderAttempt();

    await waitFor(() => {
      expect(screen.getByText('Choose a prompt below or type your own message')).toBeInTheDocument();
    });

    expect(screen.getByText('Hi, how are you?')).toBeInTheDocument();
    expect(screen.getByText('What can I help you with?')).toBeInTheDocument();
  });

  it('handles end chat functionality', async () => {
    const mockEndChatResponse = {
      ok: true,
      json: () => Promise.resolve({ success: true }),
    };

    (global.fetch as any).mockResolvedValue(mockEndChatResponse);

    renderAttempt();

    await waitFor(() => {
      expect(screen.getByText('End Chat')).toBeInTheDocument();
    });

    const endChatButton = screen.getByText('End Chat');
    fireEvent.click(endChatButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/simulations/continue'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  it('displays documents panel when available', async () => {
    renderAttempt();

    await waitFor(() => {
      expect(screen.getByTestId('document-viewer')).toBeInTheDocument();
    });

    expect(screen.getByText('Document: Course Syllabus')).toBeInTheDocument();
  });

  it('shows results when all chats are completed', async () => {
    const completedChats = mockChats.map(chat => ({ ...chat, completed: true }));
    const { getSimulationChatsByAttempt } = require('@/utils/queries/simulation_chats/get-simulation-chats-by-attempt');
    getSimulationChatsByAttempt.mockResolvedValue(completedChats);

    renderAttempt();

    await waitFor(() => {
      expect(screen.getByText('Session Results')).toBeInTheDocument();
    });
  });

  it('displays rubric when toggle is enabled in results', async () => {
    const completedChats = mockChats.map(chat => ({ ...chat, completed: true }));
    const { getSimulationChatsByAttempt } = require('@/utils/queries/simulation_chats/get-simulation-chats-by-attempt');
    getSimulationChatsByAttempt.mockResolvedValue(completedChats);

    renderAttempt();

    await waitFor(() => {
      expect(screen.getByText('Session Results')).toBeInTheDocument();
    });

    const rubricToggle = screen.getByRole('button', { name: /show rubric/i });
    fireEvent.click(rubricToggle);

    await waitFor(() => {
      expect(screen.getByTestId('table-rubric')).toBeInTheDocument();
    });
  });

  it('handles scroll to bottom functionality', async () => {
    renderAttempt();

    await waitFor(() => {
      expect(screen.getByTestId('message-input')).toBeInTheDocument();
    });

    // Simulate scroll event to show scroll button
    const scrollArea = document.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollArea) {
      Object.defineProperty(scrollArea, 'scrollHeight', { value: 1000 });
      Object.defineProperty(scrollArea, 'clientHeight', { value: 400 });
      Object.defineProperty(scrollArea, 'scrollTop', { value: 0 });

      fireEvent.scroll(scrollArea);

      await waitFor(() => {
        expect(screen.getByTestId('scroll-to-bottom-button')).toBeInTheDocument();
      });

      const scrollButton = screen.getByTestId('scroll-to-bottom-button');
      fireEvent.click(scrollButton);
    }
  });

  it('handles auto-focus typing functionality', async () => {
    renderAttempt();

    await waitFor(() => {
      expect(screen.getByTestId('message-input')).toBeInTheDocument();
    });

    // Simulate typing when not focused on input
    fireEvent.keyDown(document, { key: 'a' });

    const messageInput = screen.getByTestId('message-input') as HTMLTextAreaElement;
    expect(document.activeElement).toBe(messageInput);
  });

  it('displays error when attempt not found', async () => {
    const { getSimulationAttempt } = require('@/utils/queries/simulation_attempts/get-simulation-attempt');
    getSimulationAttempt.mockRejectedValue(new Error('Not found'));

    renderAttempt('invalid-attempt');

    await waitFor(() => {
      expect(screen.getByText('Attempt Not Found')).toBeInTheDocument();
    });

    expect(screen.getByText('Return To Dashboard')).toBeInTheDocument();
  });

  it('handles time limit expiration', async () => {
    // Mock an attempt that started 31 minutes ago (past the 30-minute limit)
    const expiredAttempt = {
      ...mockAttempt,
      createdAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    };

    const { getSimulationAttempt } = require('@/utils/queries/simulation_attempts/get-simulation-attempt');
    getSimulationAttempt.mockResolvedValue(expiredAttempt);

    renderAttempt();

    await waitFor(() => {
      expect(screen.getByText("Time's up! The session has ended.")).toBeInTheDocument();
    });
  });

  it('handles single chat attempt mode', async () => {
    const singleChatSimulation = {
      ...mockSimulation,
      scenarioIds: ['scenario1'], // Only one scenario
    };

    const { getSimulation } = require('@/utils/queries/simulations/get-simulation');
    getSimulation.mockResolvedValue(singleChatSimulation);

    renderAttempt();

    await waitFor(() => {
      expect(screen.getByText('End Session')).toBeInTheDocument();
    });

    // Should not show chat counter for single chat
    expect(screen.queryByTestId('chat-counter')).not.toBeInTheDocument();
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
