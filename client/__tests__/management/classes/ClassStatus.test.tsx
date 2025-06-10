import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import ClassStatus from '@/components/management/classes/ClassStatus';

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

// Import mocked functions
import { getClass } from '@/utils/queries/classes/get-class';
import { getTopicsByClass } from '@/utils/queries/topics/get-topics-by-class';
import { getSchedulesByClass } from '@/utils/queries/schedules/get-schedules-by-class';
import { getEventsBySchedules } from '@/utils/queries/events/get-events-by-schedules';
import { getDocumentsByClass } from '@/utils/queries/documents/get-documents-by-class';

const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

// Mock data
const mockClass = {
  id: 'class-1',
  name: 'Mathematics 101',
  classCode: 'MATH101',
  year: 2024,
  term: 'fall',
  description: 'Introduction to Mathematics',
};

const mockDocuments = [
  {
    id: 'doc-1',
    name: 'syllabus.pdf',
    type: 'syllabus',
    classId: 'class-1',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'doc-2',
    name: 'homework1.pdf',
    type: 'homework',
    classId: 'class-1',
    createdAt: '2024-01-16T10:00:00Z',
  },
  {
    id: 'doc-3',
    name: 'lecture1.pdf',
    type: 'lecture',
    classId: 'class-1',
    createdAt: '2024-01-17T10:00:00Z',
  },
];

const mockTopics = [
  { id: 'topic-1', name: 'Algebra', classId: 'class-1' },
  { id: 'topic-2', name: 'Geometry', classId: 'class-1' },
];

const mockSchedules = [
  { id: 'schedule-1', name: 'Fall 2024', classId: 'class-1' },
];

const mockEvents = [
  { id: 'event-1', name: 'Midterm Exam', scheduleId: 'schedule-1' },
];

describe('ClassStatus', () => {
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
    (getClass as any).mockResolvedValue(mockClass);
    (getTopicsByClass as any).mockResolvedValue(mockTopics);
    (getSchedulesByClass as any).mockResolvedValue(mockSchedules);
    (getEventsBySchedules as any).mockResolvedValue(mockEvents);
    (getDocumentsByClass as any).mockResolvedValue(mockDocuments);
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
      renderWithProviders(<ClassStatus classId="class-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Mathematics 101')).toBeInTheDocument();
      });
    });

    it('should render with required classId prop', async () => {
      const classId = 'test-class-123';
      renderWithProviders(<ClassStatus classId={classId} />);
      
      await waitFor(() => {
        expect(getClass).toHaveBeenCalledWith(classId);
      });
    });

    it('should display class information', async () => {
      renderWithProviders(<ClassStatus classId="class-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Mathematics 101')).toBeInTheDocument();
        expect(screen.getByText('MATH101')).toBeInTheDocument();
      });
    });

    it('should display processing status', async () => {
      renderWithProviders(<ClassStatus classId="class-1" />);
      
      await waitFor(() => {
        expect(screen.getByText(/Processing complete!/)).toBeInTheDocument();
      });
    });

    it('should display document statistics', async () => {
      renderWithProviders(<ClassStatus classId="class-1" />);
      
      await waitFor(() => {
        expect(screen.getByText(/Documents processed:/)).toBeInTheDocument();
        expect(screen.getByText('Syllabus detected')).toBeInTheDocument();
      });
    });

    it('should have correct accessibility attributes', async () => {
      renderWithProviders(<ClassStatus classId="class-1" />);
      
      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should display class information without interactive elements', async () => {
      renderWithProviders(<ClassStatus classId="class-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Mathematics 101')).toBeInTheDocument();
        expect(screen.getByText('Processing complete!')).toBeInTheDocument();
      });
    });
  });

  describe('Processing Status', () => {
    it('should show extracting stage for no documents', async () => {
      (getDocumentsByClass as any).mockResolvedValue([]);
      
      renderWithProviders(<ClassStatus classId="class-1" />);
      
      await waitFor(() => {
        expect(screen.getByText(/Extracting files from ZIP/)).toBeInTheDocument();
      });
    });

    it('should show analyzing stage for partial processing', async () => {
      const partialDocs = [
        { ...mockDocuments[0], type: 'syllabus' },
        { ...mockDocuments[1], type: '' }, // Unclassified
      ];
      (getDocumentsByClass as any).mockResolvedValue(partialDocs);
      
      renderWithProviders(<ClassStatus classId="class-1" />);
      
      await waitFor(() => {
        expect(screen.getByText(/Analyzing document content and structure/)).toBeInTheDocument();
      });
    });

    it('should show complete stage for fully processed documents', async () => {
      renderWithProviders(<ClassStatus classId="class-1" />);
      
      await waitFor(() => {
        expect(screen.getByText(/Processing complete!/)).toBeInTheDocument();
      });
    });

    it('should display progress bar', async () => {
      renderWithProviders(<ClassStatus classId="class-1" />);
      
      await waitFor(() => {
        const progressBar = document.querySelector('[role="progressbar"]');
        expect(progressBar).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('should fetch all required data', async () => {
      renderWithProviders(<ClassStatus classId="class-1" />);
      
      await waitFor(() => {
        expect(getClass).toHaveBeenCalledWith('class-1');
        expect(getTopicsByClass).toHaveBeenCalledWith(['class-1']);
        expect(getSchedulesByClass).toHaveBeenCalledWith(['class-1']);
        expect(getDocumentsByClass).toHaveBeenCalledWith(['class-1']);
      });
    });

    it('should handle loading states', () => {
      (getClass as any).mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderWithProviders(<ClassStatus classId="class-1" />);
      
      // Should show loading skeletons
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('should handle API errors gracefully', async () => {
      (getClass as any).mockRejectedValue(new Error('API Error'));
      
      renderWithProviders(<ClassStatus classId="class-1" />);
      
      // Should not crash on API error
      await waitFor(() => {
        expect(getClass).toHaveBeenCalledWith('class-1');
      });
    });
  });

  describe('Document Analysis', () => {
    it('should detect syllabus document', async () => {
      renderWithProviders(<ClassStatus classId="class-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Syllabus detected')).toBeInTheDocument();
      });
    });

    it('should categorize document types', async () => {
      renderWithProviders(<ClassStatus classId="class-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Syllabus detected')).toBeInTheDocument();
      });
    });

    it('should handle unknown document types', async () => {
      const docsWithUnknown = [
        ...mockDocuments,
        {
          id: 'doc-4',
          name: 'unknown.pdf',
          type: null,
          classId: 'class-1',
          createdAt: '2024-01-18T10:00:00Z',
        },
      ];
      (getDocumentsByClass as any).mockResolvedValue(docsWithUnknown);
      
      renderWithProviders(<ClassStatus classId="class-1" />);
      
      await waitFor(() => {
        // Check that the component renders with the additional document
        expect(screen.getByText(/Documents processed:/)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty class data', async () => {
      (getClass as any).mockResolvedValue(null);
      
      renderWithProviders(<ClassStatus classId="class-1" />);
      
      // Should not crash with null class data
      await waitFor(() => {
        expect(getClass).toHaveBeenCalledWith('class-1');
      });
    });

    it('should handle empty documents list', async () => {
      (getDocumentsByClass as any).mockResolvedValue([]);
      
      renderWithProviders(<ClassStatus classId="class-1" />);
      
      await waitFor(() => {
        expect(screen.getByText(/Extracting files from ZIP/)).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      (getDocumentsByClass as any).mockRejectedValue(new Error('Network error'));
      
      renderWithProviders(<ClassStatus classId="class-1" />);
      
      // Should not crash on network error
      await waitFor(() => {
        expect(getDocumentsByClass).toHaveBeenCalledWith(['class-1']);
      });
    });

    it('should handle invalid classId', async () => {
      renderWithProviders(<ClassStatus classId="" />);
      
      // Should still make API calls even with empty classId
      expect(getClass).toHaveBeenCalledWith('');
    });
  });
});

/*
 * Component Analysis for ClassStatus:
 * Path: management/classes/ClassStatus.tsx
 * 
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None detected
 * - Client component: false
 * - Uses hooks: useState, useEffect, useRouter, useQuery, useQueryClient
 * - Uses router: true
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: true
 * - Uses effects: true
 * - Uses context: false
 * 
 * TODO: Implement the failing tests above with actual test logic
 * 
 * Example implementations:
 * 
 * Basic rendering:
 * render(<ClassStatus />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 * 
 * Props testing:
 * const props = { ... };
 * render(<ClassStatus {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 * 
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
