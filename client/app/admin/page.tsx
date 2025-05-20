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

// Import UI components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CalendarDays, BarChart3, Users, ArrowUpRight, ArrowDownRight, Activity, Brain, ChevronRight, ChevronUp, ChevronDown, X } from "lucide-react"; // Added X icon for close button

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

// Mock data for TA performance
const mockPerformance = {
  totalTAs: 24,
  avgScore: 83,
  totalInteractions: 342,
  requireAttention: 3,
  recentInteractions: [
    { id: 1, ta: "Alex Johnson", studentType: "Confused", score: 78, date: "2023-09-22T13:45:00", class: "CS 182" },
    { id: 2, ta: "Maria Garcia", studentType: "Happy", score: 92, date: "2023-09-22T10:20:00", class: "CS 253" },
    { id: 3, ta: "David Lee", studentType: "Angry", score: 65, date: "2023-09-21T16:30:00", class: "CS 381" },
    { id: 4, ta: "Sarah Wilson", studentType: "Confused", score: 88, date: "2023-09-21T14:15:00", class: "CS 182" },
    { id: 5, ta: "James Brown", studentType: "Happy", score: 95, date: "2023-09-20T11:50:00", class: "CS XYZ" },
    { id: 6, ta: "Alex Johnson", studentType: "Happy", score: 85, date: "2023-09-20T09:10:00", class: "CS 253" }, // Alex again, different type/score
    { id: 7, ta: "Robert Miller", studentType: "Angry", score: 58, date: "2023-09-19T17:00:00", class: "CS 381" },
    { id: 8, ta: "Maria Garcia", studentType: "Confused", score: 70, date: "2023-09-19T15:25:00", class: "CS 182" }, // Maria again
    { id: 9, ta: "David Lee", studentType: "Confused", score: 81, date: "2023-09-18T11:05:00", class: "CS XYZ" }, // David again
    { id: 10, ta: "Sarah Wilson", studentType: "Happy", score: 97, date: "2023-09-18T08:55:00", class: "CS 253" }, // Sarah again
    { id: 11, ta: "Alex Johnson", studentType: "Angry", score: 60, date: "2023-09-17T14:30:00", class: "CS 381" }, // Alex, third time
    { id: 12, ta: "James Brown", studentType: "Confused", score: 77, date: "2023-09-17T10:00:00", class: "CS 182" } // James again
  ],
  typePerformance: {
    Happy: 87,
    Confused: 72,
    Angry: 68
  },
  topPerformers: [
    { name: "Maria Garcia", avatar: "MG", score: 94 },
    { name: "James Brown", avatar: "JB", score: 91 },
    { name: "Sarah Wilson", avatar: "SW", score: 89 }
  ],
  needImprovement: [
    { name: "David Lee", avatar: "DL", score: 61 },
    { name: "John Smith", avatar: "JS", score: 65 },
    { name: "Emily Davis", avatar: "ED", score: 69 }
  ]
};

// Mock data for courses
const mockCourses = [
  {
    id: "cs182",
    code: "CS 182",
    name: "Foundations of Computer Science",
    description: "Introduction to discrete mathematics, logic, and proof techniques for computer science",
    taCount: 8,
    studentCount: 120,
    image: "/images/courses/cs182.jpg"
  },
  {
    id: "cs253",
    code: "CS 253",
    name: "Data Structures and Algorithms for DS/AI",
    description: "Specialized data structures and algorithms for data science and artificial intelligence applications",
    taCount: 6,
    studentCount: 85,
    image: "/images/courses/cs253.jpg"
  },
  {
    id: "cs381",
    code: "CS 381",
    name: "Introduction to the Analysis of Algorithms",
    description: "Techniques for designing efficient algorithms and analyzing their complexity",
    taCount: 5,
    studentCount: 70,
    image: "/images/courses/cs381.jpg"
  },
  {
    id: "csxyz",
    code: "CS XYZ",
    name: "General",
    description: "For TA's who are not assigned to a specific course",
    taCount: 4,
    studentCount: 65,
    image: "/images/courses/csxyz.jpg"
  }
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showNeedAttentionModal, setShowNeedAttentionModal] = useState(false);
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  // New state variables for the additional modals
  const [showTotalTAsModal, setShowTotalTAsModal] = useState(false);
  const [showAvgScoreModal, setShowAvgScoreModal] = useState(false);
  const [showTotalInteractionsModal, setShowTotalInteractionsModal] = useState(false);
  
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: documents } = useQuery<UploadedDocument[]>({ // Specify the expected data type
    queryKey: ['documents'],
    queryFn: () => getDocuments(), // Ensure getDocuments returns Promise<UploadedDocument[]>
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers(),
  });

  const handleLogout = async () => {
    setLoading(true);
    try {
      const { success, error } = await logout();
      if (success) {
        router.push('/');
      } else {
        throw new Error(error);
      }
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteFile = async (documentId: string) => {
    try {
        setLoading(true);
        
        // Show confirmation dialog
        if (!confirm("Are you sure you want to delete this document?")) {
            setLoading(false);
            return;
        }
        
        // Call the delete function
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents/id/${documentId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to delete document');
        }
        
        
        // Sho  w success notification
        toast.success("Document deleted successfully");
        
        // Invalidate document queries to refresh the list
        queryClient.invalidateQueries({ queryKey: ['documents'] });
    } catch (error) {
        console.error("Error deleting file:", error);
        toast.error("An error occurred while deleting the document");
    } finally {
        setLoading(false);
    }
  };

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

  const sortedInteractions = useMemo(() => {
    let sortableItems = [...mockPerformance.recentInteractions];
    if (sortColumn) {
      sortableItems.sort((a, b) => {
        let valA = a[sortColumn as keyof typeof a];
        let valB = b[sortColumn as keyof typeof b];

        // Handle date sorting
        if (sortColumn === 'date') {
          valA = new Date(valA as string).getTime();
          valB = new Date(valB as string).getTime();
        }

        if (valA < valB) {
          return sortDirection === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
          return sortDirection === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [mockPerformance.recentInteractions, sortColumn, sortDirection]);
  
  const totalInteractions = sortedInteractions.length;
  const totalPages = Math.ceil(totalInteractions / itemsPerPage);

  const paginatedInteractions = sortedInteractions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  // Handle course card click
  const handleCourseClick = (courseId: string) => {
    // Navigate to course detail page
    router.push(`/admin/courses/${courseId}`);
  };

  // Function to format date to readable format
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Modal component for displaying TAs needing improvement
  const NeedAttentionModal = () => {
    if (!showNeedAttentionModal) return null;
    
    return (
      <div 
        className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50" 
        onClick={() => setShowNeedAttentionModal(false)}
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">TAs Needing Improvement</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowNeedAttentionModal(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="space-y-4">
            {mockPerformance.needImprovement.map((ta, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-red-100 text-red-800">{ta.avatar}</AvatarFallback>
                  </Avatar>
                  <div className="font-medium">{ta.name}</div>
                </div>
                <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                  {ta.score}%
                </Badge>
              </div>
            ))}
          </div>
          
          <div className="mt-6">
            <Button className="w-full" onClick={() => setShowNeedAttentionModal(false)}>Close</Button>
          </div>
        </div>
      </div>
    );
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

  // New modal component for Total TAs
  const TotalTAsModal = () => {
    if (!showTotalTAsModal) return null;
    
    return (
      <div 
        className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50" 
        onClick={() => setShowTotalTAsModal(false)}
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">Total Teaching Assistants</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowTotalTAsModal(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="py-8 text-center">
            <Users className="h-12 w-12 mx-auto text-primary/60 mb-4" />
            <p className="text-xl font-medium text-muted-foreground">Work in Progress...</p>
            <p className="mt-2 text-muted-foreground">Detailed TA information coming soon.</p>
          </div>
          
          <div className="mt-6">
            <Button className="w-full" onClick={() => setShowTotalTAsModal(false)}>Close</Button>
          </div>
        </div>
      </div>
    );
  };

  // New modal component for Average Score
  const AvgScoreModal = () => {
    if (!showAvgScoreModal) return null;
    
    return (
      <div 
        className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50" 
        onClick={() => setShowAvgScoreModal(false)}
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">Average Score Details</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowAvgScoreModal(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="py-8 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-primary/60 mb-4" />
            <p className="text-xl font-medium text-muted-foreground">Work in Progress...</p>
            <p className="mt-2 text-muted-foreground">Detailed scoring analytics coming soon.</p>
          </div>
          
          <div className="mt-6">
            <Button className="w-full" onClick={() => setShowAvgScoreModal(false)}>Close</Button>
          </div>
        </div>
      </div>
    );
  };

  // New modal component for Total Interactions
  const TotalInteractionsModal = () => {
    if (!showTotalInteractionsModal) return null;
    
    return (
      <div 
        className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50" 
        onClick={() => setShowTotalInteractionsModal(false)}
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">Interaction Analytics</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowTotalInteractionsModal(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="py-8 text-center">
            <Activity className="h-12 w-12 mx-auto text-primary/60 mb-4" />
            <p className="text-xl font-medium text-muted-foreground">Work in Progress...</p>
            <p className="mt-2 text-muted-foreground">Detailed interaction statistics coming soon.</p>
          </div>
          
          <div className="mt-6">
            <Button className="w-full" onClick={() => setShowTotalInteractionsModal(false)}>Close</Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8">
      {/* Render all modals */}
      <NeedAttentionModal />
      <AddCourseModal />
      <TotalTAsModal />
      <AvgScoreModal />
      <TotalInteractionsModal />
      
      {/* Rest of the content */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track GTA performance with AI student interactions</p>
        </div>
        <Button variant="outline" onClick={handleLogout} disabled={loading}>
          {loading ? "Logging out..." : "Logout"}
        </Button>
      </div>

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 bg-transparent p-0">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-4">
          {/* Overview Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card 
              className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50" 
              onClick={() => setShowTotalTAsModal(true)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total TAs</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mockPerformance.totalTAs}</div>
                <p className="text-xs text-muted-foreground">Active teaching assistants</p>
              </CardContent>
            </Card>
            
            <Card 
              className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50" 
              onClick={() => setShowAvgScoreModal(true)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <div className="text-2xl font-bold">{mockPerformance.avgScore}%</div>
                  <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    +2.5%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">From all interactions</p>
              </CardContent>
            </Card>
            
            <Card 
              className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50" 
              onClick={() => setShowTotalInteractionsModal(true)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Interactions</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <div className="text-2xl font-bold">{mockPerformance.totalInteractions}</div>
                  <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    +12%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Today</p>
              </CardContent>
            </Card>
            
            <Card 
              className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50" 
              onClick={() => setShowNeedAttentionModal(true)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Need Attention</CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <div className="text-2xl font-bold">{mockPerformance.requireAttention}</div>
                  <Badge variant="outline" className="ml-2 bg-red-50 text-red-700 border-red-200">
                    <ArrowDownRight className="h-3 w-3 mr-1" />
                    Critical
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">TAs scoring below 70%</p>
              </CardContent>
            </Card>
          </div>
          
          {/* Performance by Student Type */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Performance by Student Type</CardTitle>
                <CardDescription>How TAs perform with different student personalities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="h-4 w-4 rounded-full bg-green-500 mr-2"></div>
                        <span className="font-medium">Happy Students</span>
                      </div>
                      <span className="font-bold">{mockPerformance.typePerformance.Happy}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${mockPerformance.typePerformance.Happy}%` }}></div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="h-4 w-4 rounded-full bg-amber-500 mr-2"></div>
                        <span className="font-medium">Confused Students</span>
                      </div>
                      <span className="font-bold">{mockPerformance.typePerformance.Confused}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${mockPerformance.typePerformance.Confused}%` }}></div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="h-4 w-4 rounded-full bg-red-500 mr-2"></div>
                        <span className="font-medium">Angry Students</span>
                      </div>
                      <span className="font-bold">{mockPerformance.typePerformance.Angry}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${mockPerformance.typePerformance.Angry}%` }}></div>
                    </div>
                  </div>

                  {/* Coming Soon Placeholder - Modified */}
                  <div className="pt-2 text-center"> {/* Removed border, adjusted padding/margin */}
                    <p className="text-sm text-muted-foreground">More Student Types Coming Soon...</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>TA Performance</CardTitle>
                <CardDescription>Top and bottom performers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Top Performers</h4>
                    <div className="space-y-2">
                      {mockPerformance.topPerformers.map((ta, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10">{ta.avatar}</AvatarFallback>
                            </Avatar>
                            <span>{ta.name}</span>
                          </div>
                          <Badge variant="secondary">{ta.score}%</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Need Improvement</h4>
                    <div className="space-y-2">
                      {mockPerformance.needImprovement.map((ta, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-red-100 text-red-800">{ta.avatar}</AvatarFallback>
                            </Avatar>
                            <span>{ta.name}</span>
                          </div>
                          <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">{ta.score}%</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Interactions</CardTitle>
              <CardDescription>Latest TA sessions with AI students</CardDescription>
            </CardHeader>
            <CardContent>
              {mockPerformance.recentInteractions.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                      <thead className="bg-background"> {/* Changed background class */}
                        <tr>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted"
                            onClick={() => handleSort('ta')}
                          >
                            <div className="flex items-center">
                              Teaching Assistant
                              {sortColumn === 'ta' ? 
                                (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />) :
                                <ChevronDown className="h-4 w-4 ml-1 text-muted-foreground/50" />
                              }
                            </div>
                          </th>
                          {/* Swapped Class and Student Type columns */}
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted"
                            onClick={() => handleSort('class')}
                          >
                            <div className="flex items-center">
                              Class
                              {sortColumn === 'class' ? 
                                (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />) :
                                <ChevronDown className="h-4 w-4 ml-1 text-muted-foreground/50" />
                              }
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted"
                            onClick={() => handleSort('studentType')}
                          >
                            <div className="flex items-center">
                              Student Type
                              {sortColumn === 'studentType' ? 
                                (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />) :
                                <ChevronDown className="h-4 w-4 ml-1 text-muted-foreground/50" />
                              }
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted"
                            onClick={() => handleSort('score')}
                          >
                            <div className="flex items-center">
                              Score
                              {sortColumn === 'score' ? 
                                (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />) :
                                <ChevronDown className="h-4 w-4 ml-1 text-muted-foreground/50" />
                              }
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted"
                            onClick={() => handleSort('date')}
                          >
                            <div className="flex items-center">
                              Date
                              {sortColumn === 'date' ? 
                                (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />) :
                                <ChevronDown className="h-4 w-4 ml-1 text-muted-foreground/50" />
                              }
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {paginatedInteractions.map((interaction) => (
                          <tr key={interaction.id}>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-foreground">{interaction.ta}</div>
                            </td>
                            {/* Swapped Class and Student Type cells */}
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-muted-foreground">{interaction.class}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-muted-foreground">{interaction.studentType}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <Badge
                                variant="outline"
                                className={`text-xs font-semibold
                                  ${interaction.score >= 80 ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200' : 
                                  interaction.score >= 70 ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200' : 
                                  'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'}`}
                              >
                                {interaction.score}%
                              </Badge>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">
                              {formatDate(interaction.date)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-4">No recent interactions to display.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <DocumentUploader 
            onUploadComplete={() => queryClient.invalidateQueries({ queryKey: ['documents'] })}
          />
          
          <Card>
            <CardHeader>
              <CardTitle>Uploaded Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {documents && documents.length > 0 ? (
                <div className="border rounded-md">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="p-3 text-left font-medium">Document Name</th>
                        <th className="p-3 text-left font-medium">Student Type</th>
                        {/* Removed Class column header */}
                        <th className="p-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents?.map((doc) => (
                        <tr key={doc.id} className="border-b">
                          <td className="p-3">{doc.name}</td>
                          <td className="p-3 capitalize">
                            {doc.profile} Student
                          </td>
                          {/* Removed Class data cell */}
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive/80"
                              onClick={() => handleDeleteFile(doc.id)}
                              disabled={loading}
                            >
                              {loading ? "Deleting..." : "Delete"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground">No documents uploaded yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mockCourses.map((course) => (
              <Card 
                key={course.id} 
                className="transition-all hover:shadow-md cursor-pointer hover:border-primary/50"
                onClick={() => handleCourseClick(course.id)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="font-medium">{course.code}</Badge>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <CardTitle className="mt-2">{course.name}</CardTitle>
                  <CardDescription>{course.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm">
                    <Users className="h-4 w-4 mr-1 text-muted-foreground" />
                    <span><strong>{course.taCount}</strong> Teaching Assistants</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Course Management</CardTitle>
              <CardDescription>Overview of active courses and teaching assistant allocations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full bg-green-500"></div>
                    <span className="font-medium">Total Courses</span>
                  </div>
                  <span className="font-bold">{mockCourses.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full bg-blue-500"></div>
                    <span className="font-medium">Total Teaching Assistants</span>
                  </div>
                  <span className="font-bold">
                    {mockCourses.reduce((total, course) => total + course.taCount, 0)}
                  </span>
                </div>
                <div className="pt-4">
                  <Button 
                    className="w-full" 
                    onClick={() => setShowAddCourseModal(true)} // Add click handler
                  >
                    Add New Course
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}