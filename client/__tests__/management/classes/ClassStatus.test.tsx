/**
 * ClassStatus.test.tsx
 * Test suite for the ClassStatus component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ClassStatus from '@/components/management/classes/ClassStatus';
import { getClass } from '@/utils/queries/classes/get-class';
import { getTopicsByClass } from '@/utils/queries/topics/get-topics-by-class';
import { getSchedulesByClass } from '@/utils/queries/schedules/get-schedules-by-class';
import { getEventsBySchedules } from '@/utils/queries/events/get-events-by-schedules';
import { getDocumentsByClass } from '@/utils/queries/documents/get-documents-by-class';
import { Document, Topic, Event } from '@/types';

// Mock the queries
vi.mock('@/utils/queries/classes/get-class', () => ({
  getClass: vi.fn(),
}));

vi.mock('@/utils/queries/topics/get-topics-by-class', () => ({
  getTopicsByClass: vi.fn(),
}));

vi.mock('@/utils/queries/schedules/get-schedules-by-class', () => ({
  getSchedulesByClass: vi.fn(),
}));

vi.mock('@/utils/queries/events/get-events-by-schedules', () => ({
  getEventsBySchedules: vi.fn(),
}));

vi.mock('@/utils/queries/documents/get-documents-by-class', () => ({
  getDocumentsByClass: vi.fn(),
}));

// Mock data
const mockClass = {
  id: 'class1',
  name: 'Introduction to Computer Science',
  classCode: 'CS101',
  term: 'fall' as const,
  year: 2024,
  description: 'Basic computer science concepts',
  createdAt: '2024-01-01T00:00:00Z',
};

const mockDocuments = [
  {
    id: 'doc1',
    name: 'syllabus.pdf',
    type: 'syllabus' as const,
    classId: 'class1',
    createdAt: '2024-01-01T00:00:00Z',
    filePath: 'syllabus.pdf',
    mimeType: 'application/pdf',
    classified: true,
  },
  {
    id: 'doc2',
    name: 'homework1.pdf',
    type: 'homework' as const,
    classId: 'class1',
    createdAt: '2024-01-02T00:00:00Z',
    filePath: 'homework1.pdf',
    mimeType: 'application/pdf',
    classified: true,
  },
  {
    id: 'doc3',
    name: 'project1.pdf',
    type: 'project' as const,
    classId: 'class1',
    createdAt: '2024-01-03T00:00:00Z',
    filePath: 'project1.pdf',
    mimeType: 'application/pdf',
    classified: true,
  },
];

const mockTopics = [
  {
    id: 'topic1',
    name: 'Variables and Data Types',
    classId: 'class1',
    description: 'Variables and Data Types',
    prerequisite: false,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'topic2',
    name: 'Control Structures',
    classId: 'class1',
    description: 'Control Structures',
    prerequisite: false,
    createdAt: '2024-01-02T00:00:00Z',
  },
];

const mockSchedules = [
  {
    id: 'schedule1',
    name: 'Lecture Schedule',
    description: 'MWF 10:00-11:00',
    classId: 'class1',
    createdAt: '2024-01-01T00:00:00Z',
  },
];

const mockEvents = [
  {
    id: 'event1',
    name: 'Midterm Exam',
    scheduleId: 'schedule1',
    description: 'Midterm Exam',
    documentType: 'midterm' as const,
    time: '10:00-11:00',
    createdAt: '2024-01-01T00:00:00Z',
  },
];

describe('ClassStatus Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Setup mock implementations


    vi.mocked(getClass).mockResolvedValue(mockClass);
    vi.mocked(getTopicsByClass).mockResolvedValue(mockTopics);
    vi.mocked(getSchedulesByClass).mockResolvedValue(mockSchedules);
    vi.mocked(getEventsBySchedules).mockResolvedValue(mockEvents);
    vi.mocked(getDocumentsByClass).mockResolvedValue(mockDocuments);
  });

  const renderComponent = (classId = 'class1') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ClassStatus classId={classId} />
      </QueryClientProvider>
    );
  };

  it('renders loading state initially', () => {
    renderComponent();
    expect(screen.getByText('Loading class analytics...')).toBeInTheDocument();
  });

  it('renders class information when loaded', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Class Information')).toBeInTheDocument();
      expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
      expect(screen.getByText('CS101')).toBeInTheDocument();
      expect(screen.getByText('fall 2024')).toBeInTheDocument();
    });
  });

  it('displays processing status with progress', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Processing complete!/)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  it('shows document classification when documents are available', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Document Classification')).toBeInTheDocument();
      expect(screen.getByText('Syllabus')).toBeInTheDocument();
      expect(screen.getByText('Homework')).toBeInTheDocument();
      expect(screen.getByText('Project')).toBeInTheDocument();
    });
  });

  it('displays syllabus detection badge when syllabus is found', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Syllabus detected')).toBeInTheDocument();
    });
  });

  it('shows identified topics', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Topics Identified')).toBeInTheDocument();
      expect(screen.getByText('Variables and Data Types')).toBeInTheDocument();
      expect(screen.getByText('Control Structures')).toBeInTheDocument();
    });
  });

  it('displays schedules and events', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Schedules')).toBeInTheDocument();
      expect(screen.getByText('Lecture Schedule')).toBeInTheDocument();
      expect(screen.getByText('Upcoming Events')).toBeInTheDocument();
      expect(screen.getByText('Midterm Exam')).toBeInTheDocument();
    });
  });

  it('handles class not found error', async () => {
    vi.mocked(getClass).mockResolvedValue(null);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Class Not Found')).toBeInTheDocument();
      expect(screen.getByText('The requested class could not be found.')).toBeInTheDocument();
    });
  });

  it('shows processing stages correctly', async () => {
    
    
    // Test with partially processed documents
    const partialDocuments = [
      { ...mockDocuments[0] } as Document,
      { ...mockDocuments[1], type: null } as unknown as Document, // Unprocessed
    ];
    vi.mocked(getDocumentsByClass).mockResolvedValue(partialDocuments);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Analyzing document content/)).toBeInTheDocument();
    });
  });

  it('handles empty documents state', async () => {
    vi.mocked(getDocumentsByClass).mockResolvedValue([]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Class Information')).toBeInTheDocument();
      // Should not show document classification section
      expect(screen.queryByText('Document Classification')).not.toBeInTheDocument();
    });
  });

  it('limits topic display to 12 items with overflow indicator', async () => {
    const manyTopics = Array.from({ length: 15 }, (_, i) => ({
      id: `topic${i}`,
      name: `Topic ${i + 1}`,
      classId: 'class1',
      createdAt: '2024-01-01T00:00:00Z',
    })) as Topic[];

    vi.mocked(getTopicsByClass).mockResolvedValue(manyTopics);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('+3 more')).toBeInTheDocument();
    });
  });

  it('limits schedule and event display with overflow indicators', async () => {
    const manySchedules = Array.from({ length: 5 }, (_, i) => ({
      id: `schedule${i}`,
      name: `Schedule ${i + 1}`,
      description: `Description ${i + 1}`,
      classId: 'class1',
      createdAt: '2024-01-01T00:00:00Z',
    }));

    const manyEvents = Array.from({ length: 5 }, (_, i) => ({
      id: `event${i}`,
      name: `Event ${i + 1}`,
      scheduleId: 'schedule1',
      createdAt: '2024-01-01T00:00:00Z',
    })) as Event[];

    vi.mocked(getSchedulesByClass).mockResolvedValue(manySchedules);
    vi.mocked(getEventsBySchedules).mockResolvedValue(manyEvents);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('+2 more schedules')).toBeInTheDocument();
      expect(screen.getByText('+2 more events')).toBeInTheDocument();
    });
  });

  it('calculates document type counts correctly', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('1 files')).toBeInTheDocument(); // Syllabus
      expect(screen.getByText('1 files')).toBeInTheDocument(); // Homework
      expect(screen.getByText('1 files')).toBeInTheDocument(); // Project
    });
  });

  it('shows ready status when processing is complete', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });
  });
});
