/**
 * app/admin/page.tsx
 * This is the admin page to view the dashboard.
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
"use client";

import { useState, useMemo } from "react"; // Import useMemo
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUsers } from "@/utils/queries/get-users";
import { logout } from "@/utils/mutations/logout";
import { getDocuments } from "@/utils/queries/get-documents";
import { toast } from "sonner";
import DocumentUploader from "@/components/DocumentUploader";
import Analytics from "@/components/Analytics";
import Courses from "@/components/Courses";
import Documents from "@/components/Documents";

// Import UI components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CalendarDays, BarChart3, Users, ArrowUpRight, ArrowDownRight, Activity, Brain, ChevronRight, ChevronUp, ChevronDown, X } from "lucide-react"; // Added X icon for close button
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getUser } from "@/utils/queries/get-user";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Rubric from "@/components/Rubric";
import { useTaskColumns } from "@/components/tasks/columns";
import { DataTable } from "@/components/tasks/data-table";
import { Separator } from "@/components/ui/separator";

// Define an interface for the document structure
interface UploadedDocument {
  id: string;
  name: string;
  profile: string;
  class?: string;    // Standard name
  className?: string; // Possible alternative name
  courseId?: string;  // Another possible alternative
  course?: string;    // Another possible name
  // Add any other properties your document object has
}





export default function AdminPage() {
  const isAdmin = true;
  const { columns, data, isLoading, userOptions, classOptions } = useTaskColumns({ isAdmin: isAdmin });

  const [activeTab, setActiveTab] = useState('analytics');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);

  const router = useRouter();
  const queryClient = useQueryClient();

  const [showRubric, setShowRubric] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser()
  });

  const { data: documents } = useQuery<UploadedDocument[]>({ // Specify the expected data type
    queryKey: ['documents'],
    queryFn: () => getDocuments(), // Ensure getDocuments returns Promise<UploadedDocument[]>
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers(),
  });

  // Function to generate initials
  const getInitials = (name?: string) => {
    if (!name) return '';

    if (name.includes(' ')) {
      // If name has space, get first char of first and last name
      const nameParts = name.split(' ');
      return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
    } else {
      // Otherwise get first two chars of name
      return name.substring(0, 2).toUpperCase();
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);

    toast.promise(
      async () => {
        try {
          const { success, error } = await logout();
          if (success) {
            router.push('/');
            return "Logged out successfully";
          } else {
            throw new Error(error);
          }
        } catch (error) {
          console.error('Error logging out:', error);
          throw new Error(typeof error === 'string' ? error : 'Failed to log out');
        } finally {
          setIsLoggingOut(false);
        }
      },
      {
        loading: 'Logging out...',
        success: (message) => message,
        error: (error) => error.message || 'Failed to log out'
      }
    );
  }

  // Document management is now handled by the Documents component

  // Pagination constants and logic
  const itemsPerPage = 5;

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page on new sort
  };

  // Use the data from the History tab instead of mock data
  const totalInteractions = 0;
  const totalPages = 0;

  // Navigation functions no longer needed since we're using the data-table component



  // Function to format date to readable format
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Modal component for "Add New Course"
  const AddCourseModal = () => {
    if (!showAddCourseModal) return null;

    return (
      <div
        className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50"
        onClick={() => setShowAddCourseModal(false)}
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">Add New Course</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowAddCourseModal(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="py-8 text-center">
            <Activity className="h-12 w-12 mx-auto text-primary/60 mb-4" />
            <p className="text-xl font-medium text-muted-foreground">Work in Progress...</p>
            <p className="mt-2 text-muted-foreground">This feature is coming soon.</p>
          </div>

          <div className="mt-6">
            <Button className="w-full" onClick={() => setShowAddCourseModal(false)}>Close</Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8">
      {/* Render all modals */}
      <AddCourseModal />

      {/* Rest of the content */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track GTA performance with AI student interactions</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.username}@purdue.edu
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setShowRubric(true)}>
                Rubric
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuItem
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={isLoggingOut ? "opacity-70 cursor-not-allowed" : ""}
            >
              {isLoggingOut ? "Logging out..." : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-4">
          <Analytics />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {/* Recent Activity */}
          <DataTable
            data={data || []}
            columns={columns}
            userOptions={userOptions}
            classOptions={classOptions}
            isAdmin={isAdmin}
          />
        </TabsContent>
        <TabsContent value="documents" className="space-y-4">
          <Documents />
        </TabsContent>

        <TabsContent value="courses" className="space-y-4">
          <Courses />
        </TabsContent>
      </Tabs>

      <Dialog open={showRubric} onOpenChange={setShowRubric}>
        <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Rubric</DialogTitle>
          </DialogHeader>
          <Rubric />
        </DialogContent>
      </Dialog>
    </div>
  );
}