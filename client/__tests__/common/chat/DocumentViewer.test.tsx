import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import DocumentViewer from '@/components/common/chat/DocumentViewer';

// Mock external dependencies
vi.mock('@/utils/queries/documents/get-all-documents', () => ({
  getAllDocuments: vi.fn(),
}));

vi.mock('@/components/common/chat/Markdown', () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown">{children}</div>
  ),
}));

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => (
    <img src={src} alt={alt} {...props} data-testid="next-image" />
  ),
}));

// Mock API calls
global.fetch = vi.fn();

import { getAllDocuments } from '@/utils/queries/documents/get-all-documents';

// Mock data
const mockDocument = {
  id: 'doc-1',
  name: 'test-document.pdf',
  type: 'homework' as const,
  classId: 'class-1',
  createdAt: '2024-01-15T10:00:00Z',
  filePath: '/path/to/test-document.pdf',
  mimeType: 'application/pdf',
  classified: true,
};

const mockDocuments = [
  mockDocument,
  {
    id: 'doc-2',
    name: 'lecture-notes.md',
    type: 'lecture' as const,
    classId: 'class-1',
    createdAt: '2024-01-16T10:00:00Z',
    filePath: '/path/to/lecture-notes.md',
    mimeType: 'text/markdown',
    classified: true,
  },
];

describe('DocumentViewer', () => {
  let queryClient: QueryClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    (getAllDocuments as any).mockResolvedValue(mockDocuments);
    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue('application/pdf'),
      },
      blob: vi.fn().mockResolvedValue(new Blob(['test content'])),
      text: vi.fn().mockResolvedValue('test content'),
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
    it('should render without crashing with no props', () => {
      renderWithProviders(<DocumentViewer />);
      
      // Should render without crashing even with no props
      expect(document.body).toBeInTheDocument();
    });

    it('should render with single document prop', async () => {
      renderWithProviders(<DocumentViewer document={mockDocument} />);
      
      await waitFor(() => {
        expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
      });
    });

    it('should render with classId prop to show document selector', async () => {
      renderWithProviders(<DocumentViewer classId="class-1" />);
      
      await waitFor(() => {
        expect(getAllDocuments).toHaveBeenCalled();
      });
    });

    it('should render in bare mode', async () => {
      renderWithProviders(<DocumentViewer document={mockDocument} bare={true} />);
      
      await waitFor(() => {
        // In bare mode, should not show header with document name
        expect(screen.queryByText('test-document.pdf')).not.toBeInTheDocument();
      });
    });

    it('should have correct accessibility attributes', async () => {
      renderWithProviders(<DocumentViewer document={mockDocument} />);
      
      await waitFor(() => {
        const downloadButton = screen.getByRole('link');
        expect(downloadButton).toHaveAttribute('download', 'test-document.pdf');
      });
    });
  });

  describe('User Interactions', () => {
    it('should handle document selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DocumentViewer classId="class-1" />);
      
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
      
      const selector = screen.getByRole('combobox');
      await user.click(selector);
      
      // Should show document options
      await waitFor(() => {
        expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
      });
    });

    it('should handle download button click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DocumentViewer document={mockDocument} />);
      
      await waitFor(() => {
        const downloadButton = screen.getByRole('link');
        expect(downloadButton).toHaveAttribute('href');
      });
    });

    it('should handle state changes when document loads', async () => {
      renderWithProviders(<DocumentViewer document={mockDocument} />);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/documents/id/doc-1')
        );
      });
    });
  });

  describe('API Integration', () => {
    it('should fetch documents when classId is provided', async () => {
      renderWithProviders(<DocumentViewer classId="class-1" />);
      
      await waitFor(() => {
        expect(getAllDocuments).toHaveBeenCalled();
      });
    });

    it('should fetch document content when document is selected', async () => {
      renderWithProviders(<DocumentViewer document={mockDocument} />);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/documents/id/doc-1')
        );
      });
    });

    it('should handle loading states', () => {
      (getAllDocuments as any).mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderWithProviders(<DocumentViewer classId="class-1" />);
      
      // Should show loading skeleton
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('should handle error states', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Failed to load'));
      
      renderWithProviders(<DocumentViewer document={mockDocument} />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load document')).toBeInTheDocument();
      });
    });
  });

  describe('Content Rendering', () => {
    it('should render PDF content', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('application/pdf'),
        },
        blob: vi.fn().mockResolvedValue(new Blob(['pdf content'])),
      });
      
      renderWithProviders(<DocumentViewer document={mockDocument} />);
      
      await waitFor(() => {
        expect(document.querySelector('iframe')).toBeInTheDocument();
      });
    });

    it('should render image content', async () => {
      const imageDoc = { ...mockDocument, name: 'image.jpg' };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('image/jpeg'),
        },
        blob: vi.fn().mockResolvedValue(new Blob(['image content'])),
      });
      
      renderWithProviders(<DocumentViewer document={imageDoc} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('next-image')).toBeInTheDocument();
      });
    });

    it('should render markdown content', async () => {
      const markdownDoc = { ...mockDocument, name: 'notes.md' };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('text/plain'),
        },
        text: vi.fn().mockResolvedValue('# Markdown Content'),
      });
      
      renderWithProviders(<DocumentViewer document={markdownDoc} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('markdown')).toBeInTheDocument();
      });
    });

    it('should render text content', async () => {
      const textDoc = { ...mockDocument, name: 'notes.txt' };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('text/plain'),
        },
        text: vi.fn().mockResolvedValue('Plain text content'),
      });
      
      renderWithProviders(<DocumentViewer document={textDoc} />);
      
      await waitFor(() => {
        expect(screen.getByText('Plain text content')).toBeInTheDocument();
      });
    });

    it('should show preview not available for unsupported types', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('application/unknown'),
        },
        blob: vi.fn().mockResolvedValue(new Blob(['unknown content'])),
      });
      
      renderWithProviders(<DocumentViewer document={mockDocument} />);
      
      await waitFor(() => {
        expect(screen.getByText('Preview not available')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing document gracefully', () => {
      renderWithProviders(<DocumentViewer />);
      
      // Should not crash with no document
      expect(document.body).toBeInTheDocument();
    });

    it('should handle empty documents array', async () => {
      (getAllDocuments as any).mockResolvedValue([]);
      
      renderWithProviders(<DocumentViewer classId="class-1" />);
      
      await waitFor(() => {
        expect(getAllDocuments).toHaveBeenCalled();
      });
      
      // Should not show selector when no documents
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('should handle network errors gracefully', async () => {
      (getAllDocuments as any).mockRejectedValue(new Error('Network error'));
      
      renderWithProviders(<DocumentViewer classId="class-1" />);
      
      await waitFor(() => {
        expect(getAllDocuments).toHaveBeenCalled();
      });
      
      // Should not crash on network error
      expect(document.body).toBeInTheDocument();
    });

    it('should handle document type info correctly', async () => {
      const homeworkDoc = { ...mockDocument, type: 'homework' as const };
      renderWithProviders(<DocumentViewer document={homeworkDoc} />);
      
      await waitFor(() => {
        // Should show homework icon/badge
        expect(screen.getByText('📝')).toBeInTheDocument();
      });
    });

    it('should handle missing document name', async () => {
      const docWithoutName = { ...mockDocument, name: '' };
      renderWithProviders(<DocumentViewer document={docWithoutName} />);
      
      // Should not crash with missing name
      expect(document.body).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for DocumentViewer:
 * Path: common/chat/DocumentViewer.tsx
 * 
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true
 * - Props interface: DocumentViewerProps
 * - Client component: true
 * - Uses hooks: useState, useEffect, useMemo, useQuery
 * - Uses router: false
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
 * render(<DocumentViewer {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 * 
 * Props testing:
 * const props = { ... };
 * render(<DocumentViewer {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 * 
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
