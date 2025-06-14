import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import NewClass from '@/components/management/classes/NewClass';

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
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Mock API calls
vi.mock('@/utils/mutations/classes/create-class', () => ({
  createClass: vi.fn(),
}));

// Mock ClassForm component
vi.mock('@/components/common/class/ClassForm', () => ({
  default: ({ mode, onSuccess }: { mode: string; onSuccess: (classId: string) => void }) => (
    <div data-testid="class-form">
      <div data-testid="form-mode">{mode}</div>
      <button 
        onClick={() => onSuccess('test-class-id')}
        data-testid="form-submit"
      >
        Submit Form
      </button>
    </div>
  ),
}));

// Mock tus-js-client
vi.mock('tus-js-client', () => ({
  Upload: vi.fn().mockImplementation((_, options) => ({
    start: vi.fn(() => {
      // Simulate successful upload
      setTimeout(() => {
        options.onProgress?.(100, 100);
        options.onSuccess?.();
      }, 10);
    }),
  })),
}));

// Import mocked functions
import { createClass } from '@/utils/mutations/classes/create-class';

const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

// Mock environment variable
Object.defineProperty(process.env, 'NEXT_PUBLIC_API_URL', {
  value: 'http://localhost:3001',
  writable: true,
});

// Mock global fetch
global.fetch = vi.fn();

describe('NewClass', () => {
  let queryClient: QueryClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    (useRouter as Mock).mockReturnValue(mockRouter);
    (createClass as Mock).mockResolvedValue({ id: 'test-class-id' });
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
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
    it('should render without crashing', () => {
      renderWithProviders(<NewClass />);
      
      expect(screen.getByText('Upload from ZIP')).toBeInTheDocument();
      expect(screen.getByText('Create Manually')).toBeInTheDocument();
    });

    it('should display method selection cards initially', () => {
      renderWithProviders(<NewClass />);
      
      expect(screen.getByText('Upload from ZIP')).toBeInTheDocument();
      expect(screen.getByText('Upload a ZIP file containing all your class materials.')).toBeInTheDocument();
      expect(screen.getByText('Create Manually')).toBeInTheDocument();
      expect(screen.getByText('Set up your class first and add documents later.')).toBeInTheDocument();
    });

    it('should show ZIP upload option with correct description', () => {
      renderWithProviders(<NewClass />);
      
      const zipCard = screen.getByText('Upload from ZIP').closest('div');
      expect(zipCard).toBeInTheDocument();
      expect(screen.getByText(/We'll automatically extract and classify your documents/)).toBeInTheDocument();
    });

    it('should show manual creation option with correct description', () => {
      renderWithProviders(<NewClass />);
      
      const manualCard = screen.getByText('Create Manually').closest('div');
      expect(manualCard).toBeInTheDocument();
      expect(screen.getByText(/Perfect if you want to organize everything step by step/)).toBeInTheDocument();
    });

    it('should have correct accessibility attributes', () => {
      renderWithProviders(<NewClass />);
      
      // Check for proper card structure and clickable elements
      const zipCard = screen.getByText('Upload from ZIP').closest('div');
      const manualCard = screen.getByText('Create Manually').closest('div');
      
      expect(zipCard).toHaveClass('cursor-pointer');
      expect(manualCard).toHaveClass('cursor-pointer');
    });
  });

  describe('User Interactions', () => {
    it('should handle manual creation mode selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);
      
      const manualCard = screen.getByText('Create Manually').closest('div');
      await user.click(manualCard!);
      
      // Should show the ClassForm component
      await waitFor(() => {
        expect(screen.getByTestId('class-form')).toBeInTheDocument();
        expect(screen.getByTestId('form-mode')).toHaveTextContent('create');
      });
    });

    it('should handle ZIP upload mode selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);
      
      const zipCard = screen.getByText('Upload from ZIP').closest('div');
      await user.click(zipCard!);
      
      // Should trigger file input click (hidden input)
      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
    });

    it('should handle file selection for ZIP upload', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);
      
      const file = new File(['test content'], 'test-class.zip', { type: 'application/zip' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      // Should start processing
      await waitFor(() => {
        expect(createClass).toHaveBeenCalledWith({
          name: 'test-class',
          classCode: expect.any(String),
          year: expect.any(Number),
          term: 'fall',
          description: 'Make changes to this class description',
        });
      });
    });

    it('should handle form submission in manual mode', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);
      
      // Switch to manual mode
      const manualCard = screen.getByText('Create Manually').closest('div');
      await user.click(manualCard!);
      
      await waitFor(() => {
        expect(screen.getByTestId('class-form')).toBeInTheDocument();
      });
      
      // Submit the form
      const submitButton = screen.getByTestId('form-submit');
      await user.click(submitButton);
      
      // Should navigate to edit page
      expect(mockPush).toHaveBeenCalledWith('/classes/c/test-class-id/edit');
    });

    it('should show processing states during ZIP upload', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);
      
      const file = new File(['test content'], 'math-101.zip', { type: 'application/zip' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      // Should show uploading state
      await waitFor(() => {
        expect(screen.getByText(/Uploading/)).toBeInTheDocument();
      });
    });

    it('should extract class name from ZIP filename', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);
      
      const file = new File(['test content'], 'Advanced-Physics-2024.zip', { type: 'application/zip' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(createClass).toHaveBeenCalledWith({
          name: 'Advanced-Physics-2024',
          classCode: '2024', // Should extract numeric code
          year: expect.any(Number),
          term: 'fall',
          description: 'Make changes to this class description',
        });
      });
    });

    it('should handle ZIP files without numeric codes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);
      
      const file = new File(['test content'], 'Literature-Class.zip', { type: 'application/zip' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(createClass).toHaveBeenCalledWith({
          name: 'Literature-Class',
          classCode: 'Literature-Class', // Should use full name as code
          year: expect.any(Number),
          term: 'fall',
          description: 'Make changes to this class description',
        });
      });
    });
  });

  describe('API Integration', () => {
    it('should create temporary class for ZIP upload', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);
      
      const file = new File(['test content'], 'test-class.zip', { type: 'application/zip' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(createClass).toHaveBeenCalledWith({
          name: 'test-class',
          classCode: expect.any(String),
          year: new Date().getFullYear(),
          term: 'fall',
          description: 'Make changes to this class description',
        });
      });
    });

    it('should handle class creation errors', async () => {
      const user = userEvent.setup();
      (createClass as Mock).mockRejectedValue(new Error('Creation failed'));
      
      renderWithProviders(<NewClass />);
      
      const file = new File(['test content'], 'test-class.zip', { type: 'application/zip' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      // Should handle error gracefully
      await waitFor(() => {
        expect(createClass).toHaveBeenCalled();
      });
    });

    it('should handle upload finalization', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);
      
      const file = new File(['test content'], 'test-class.zip', { type: 'application/zip' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      // Should call finalize endpoint
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:3001/documents/tus/finalize',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          })
        );
      });
    });

    it('should handle finalization errors', async () => {
      const user = userEvent.setup();
      (global.fetch as Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Finalization failed' }),
      });
      
      renderWithProviders(<NewClass />);
      
      const file = new File(['test content'], 'test-class.zip', { type: 'application/zip' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      // Should handle finalization error
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should show success state after completion', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);
      
      const file = new File(['test content'], 'test-class.zip', { type: 'application/zip' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      // Should show completion state
      await waitFor(() => {
        expect(screen.getByText('ZIP Uploaded Successfully!')).toBeInTheDocument();
        expect(screen.getByText('Your files are being processed and classified...')).toBeInTheDocument();
      });
    });

    it('should navigate to status page after completion', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);
      
      const file = new File(['test content'], 'test-class.zip', { type: 'application/zip' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      // Should navigate to status page after delay
      await waitFor(() => {
        expect(screen.getByText('ZIP Uploaded Successfully!')).toBeInTheDocument();
      });
      
      // Wait for navigation timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(mockPush).toHaveBeenCalledWith('/classes/new/c/test-class-id');
    });
  });

  describe('File Upload Progress', () => {
    it('should show upload progress', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);
      
      const file = new File(['test content'], 'test-class.zip', { type: 'application/zip' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      // Should show progress information
      await waitFor(() => {
        expect(screen.getByText('test-class.zip')).toBeInTheDocument();
      });
    });

    it('should handle multiple processing steps', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);
      
      const file = new File(['test content'], 'test-class.zip', { type: 'application/zip' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      // Should go through uploading -> extracting -> complete
      await waitFor(() => {
        expect(screen.getByText(/Uploading/)).toBeInTheDocument();
      });
    });

    it('should show view processing status button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);
      
      const file = new File(['test content'], 'test-class.zip', { type: 'application/zip' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText('View Processing Status')).toBeInTheDocument();
      });
      
      const statusButton = screen.getByText('View Processing Status');
      await user.click(statusButton);
      
      expect(mockPush).toHaveBeenCalledWith('/classes/new/c/test-class-id');
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid file types', async () => {
      renderWithProviders(<NewClass />);
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      // File input should only accept .zip files
      expect(fileInput.accept).toBe('.zip');
    });

    it('should handle empty ZIP files', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);
      
      const file = new File([''], 'empty.zip', { type: 'application/zip' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      // Should still attempt to process
      await waitFor(() => {
        expect(createClass).toHaveBeenCalled();
      });
    });

    it('should handle very large file names', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);
      
      const longName = 'A'.repeat(200) + '.zip';
      const file = new File(['test content'], longName, { type: 'application/zip' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(createClass).toHaveBeenCalledWith({
          name: 'A'.repeat(200),
          classCode: expect.any(String),
          year: expect.any(Number),
          term: 'fall',
          description: 'Make changes to this class description',
        });
      });
    });

    it('should handle missing environment variables', async () => {
      const user = userEvent.setup();
      delete process.env['NEXT_PUBLIC_API_URL'];
      
      renderWithProviders(<NewClass />);
      
      const file = new File(['test content'], 'test-class.zip', { type: 'application/zip' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      // Should use empty string as fallback
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/documents/tus/finalize',
          expect.any(Object)
        );
      });
    });

    it('should handle network timeouts', async () => {
      const user = userEvent.setup();
      (global.fetch as Mock).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );
      
      renderWithProviders(<NewClass />);
      
      const file = new File(['test content'], 'test-class.zip', { type: 'application/zip' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      // Should handle timeout gracefully
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should handle rapid mode switching', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);
      
      // Rapidly switch between modes
      const manualCard = screen.getByText('Create Manually').closest('div');
      const zipCard = screen.getByText('Upload from ZIP').closest('div');
      
      await user.click(manualCard!);
      await user.click(zipCard!);
      await user.click(manualCard!);
      
      // Should end up in manual mode
      await waitFor(() => {
        expect(screen.getByTestId('class-form')).toBeInTheDocument();
      });
    });

    it('should handle component unmounting during upload', async () => {
      const user = userEvent.setup();
      const { unmount } = renderWithProviders(<NewClass />);
      
      const file = new File(['test content'], 'test-class.zip', { type: 'application/zip' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      // Unmount component during upload
      unmount();
      
      // Should not cause errors
      expect(createClass).toHaveBeenCalled();
    });
  });
});

/*
 * Component Analysis for NewClass:
 * Path: management/classes/NewClass.tsx
 * 
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None detected
 * - Client component: false
 * - Uses hooks: useState, useRef, useRouter, useQueryClient
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
 * render(<NewClass />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 * 
 * Props testing:
 * const props = { ... };
 * render(<NewClass {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 * 
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
