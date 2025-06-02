/**
 * app/admin/page.tsx
 * This is the admin page to view the dashboard.
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUsers } from "@/utils/queries/get-users";
import { logout } from "@/utils/mutations/logout";
import { getClasses } from "@/utils/queries/get-classes";
import { getClass } from "@/utils/queries/get-class";
import { toast } from "sonner";
import Analytics from "@/components/Analytics";
import Documents from "@/components/Documents";
import Quiz from "@/components/Quiz";

// Import UI components
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Activity, X, Plus, Edit, Trash2, Upload } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getUser } from "@/utils/queries/get-user";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin-sidebar";
import Rubric from "@/components/Rubric";
import { useTaskColumns } from "@/components/tasks/columns";
import { DataTable } from "@/components/tasks/data-table";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { UserCheck, Download, Loader2 } from "lucide-react";
import { getAllChats } from "@/utils/queries/get-all-chats";
import { getRubrics } from "@/utils/queries/get-rubrics";
import { getProfiles } from "@/utils/queries/get-profiles";
import { format, compareAsc, startOfDay, subDays } from "date-fns";
import { updateProfile } from "@/utils/mutations/update-profile";
import { getProfileConfig, getKnownProfileNames, getProfileDefaultThreshold } from "@/utils/profiles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
// Import Recharts components
import {
  LineChart,
  Line,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import DocumentDropzone from "@/components/DocumentDropzone";

// Define an interface for the document structure
interface UploadedDocument {
  id: string;
  name: string;
  filePath: string;
  mimeType: string;
  classId: string;
  createdAt: string;
}

// Interface for Teaching Assistant with scores
interface TeachingAssistant {
  id: string;
  name: string;
  username: string;
  interactions: number;
  avgScore: number;
}

// Helper function to get initials from name
const getInitials = (name?: string): string => {
  if (!name) return "??";
  return name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export default function AdminPage() {
  const isAdmin = true;
  const { columns, data, userOptions, classOptions } =
    useTaskColumns({ isAdmin: isAdmin });

  const [activeSection, setActiveSection] = useState("home");
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);

  const router = useRouter();
  const queryClient = useQueryClient();

  const [showRubric, setShowRubric] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Extract class ID from active section if it's a class section
  const currentClassId = activeSection.startsWith("class-") ? activeSection.replace("class-", "") : null;

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(),
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getClasses(),
  });

  // Fetch specific class data when viewing a class
  const { data: classDataArray } = useQuery({
    queryKey: ["class", currentClassId],
    queryFn: () => getClass(currentClassId!),
    enabled: !!currentClassId,
  });

  const classData = useMemo(() => {
    return Array.isArray(classDataArray) ? classDataArray[0] : classDataArray;
  }, [classDataArray]);

  // Fetch chats for class details
  const { data: chats } = useQuery({
    queryKey: ["all-chats"],
    queryFn: () => getAllChats(),
    enabled: !!currentClassId,
  });

  // Fetch profiles for class details
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getProfiles(),
    enabled: !!currentClassId,
  });

  // Fetch rubrics for class details
  const { data: rubrics } = useQuery({
    queryKey: ["all-rubrics"],
    queryFn: () => getRubrics(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0 && !!currentClassId,
  });

  const handleLogout = async () => {
    setIsLoggingOut(true);

    toast.promise(
      async () => {
        try {
          const { success, error } = await logout();
          if (success) {
            router.push("/");
            return "Logged out successfully";
          } else {
            throw new Error(error);
          }
        } catch (error) {
          console.error("Error logging out:", error);
          throw new Error(
            typeof error === "string" ? error : "Failed to log out",
          );
        } finally {
          setIsLoggingOut(false);
        }
      },
      {
        loading: "Logging out...",
        success: (message) => message,
        error: (error) => error.message || "Failed to log out",
      },
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
        <div
          className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">Add New Course</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAddCourseModal(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="py-8 text-center">
            <Activity className="h-12 w-12 mx-auto text-primary/60 mb-4" />
            <p className="text-xl font-medium text-muted-foreground">
              Work in Progress...
            </p>
            <p className="mt-2 text-muted-foreground">
              This feature is coming soon.
            </p>
          </div>

          <div className="mt-6">
            <Button
              className="w-full"
              onClick={() => setShowAddCourseModal(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Get page title based on active section
  const getPageTitle = () => {
    if (activeSection === "home") return "Home";
    if (activeSection === "history") return "History";
    if (activeSection === "quiz-list") return "Quiz Management";
    if (activeSection === "quiz-create") return "Create Quiz";
    if (activeSection === "chat-profiles") return "Chat Profiles";
    if (activeSection === "chat-scenarios") return "Chat Scenarios";
    if (activeSection === "student-management") return "Student Management";
    if (activeSection.startsWith("class-") && classData) {
      return `${classData.classCode} - ${classData.name}`;
    }
    return "Admin Portal";
  };

  // Render content based on active section
  const renderContent = () => {
    switch (activeSection) {
      case "home":
        return (
          <div className="space-y-6">
            {/* Analytics Section */}
            <Analytics />
          </div>
        );
      case "history":
        return (
          <div className="space-y-6">
            {/* History Section */}
            <DataTable
              data={data || []}
              columns={columns}
              userOptions={userOptions}
              classOptions={classOptions}
              isAdmin={isAdmin}
            />
          </div>
        );
      case "quiz-list":
        return <Quiz mode="list" />;
      case "quiz-create":
        return <Quiz mode="create" />;
      case "chat-profiles":
        return <ChatProfilesContent />;
      case "chat-scenarios":
        return <ChatScenariosContent />;
      case "student-management":
        return <StudentManagementContent />;
      default:
        if (activeSection.startsWith("class-") && classData) {
          return <ClassDetailsContent classData={classData} />;
        }
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Select a section from the sidebar</p>
          </div>
        );
    }
  };

  // Class details component (inline version of the class details page)
  const ClassDetailsContent = ({ classData }: { classData: any }) => {
    const [activeEmotion, setActiveEmotion] = useState<"happy" | "confused" | "angry">("happy");

    // Generate score trend data (last 7 days)
    const scoreTrendData = useMemo(() => {
      if (!rubrics) return [];

      const today = startOfDay(new Date());
      const dates: Record<string, { date: Date; scores: number[] }> = {};

      // Initialize last 7 days
      for (let i = 0; i < 7; i++) {
        const date = subDays(today, i);
        const dateStr = format(date, "yyyy-MM-dd");
        dates[dateStr] = { date, scores: [] };
      }

      // Group scores by date
      rubrics.forEach((rubric) => {
        const createdAt = new Date(rubric.createdAt);
        const dateStr = format(createdAt, "yyyy-MM-dd");

        if (dates[dateStr]) {
          dates[dateStr].scores.push(rubric.score);
        }
      });

      // Calculate average score for each day
      return Object.entries(dates)
        .map(([dateStr, data]) => {
          const avgScore =
            data.scores.length > 0
              ? Math.round(
                data.scores.reduce((sum, score) => sum + score, 0) /
                data.scores.length,
              )
              : 0;

          return {
            date: format(data.date, "MM-dd"),
            avgScore,
          };
        })
        .sort((a, b) => compareAsc(new Date(a.date), new Date(b.date)));
    }, [rubrics]);

    // Generate emotion data based on chat profiles
    const emotionData = useMemo(() => {
      if (!chats || !profiles) return [];

      // Get chats for this class
      const classChats = chats.filter((chat) => {
        // You might need to filter by class here if chat has classId
        return true; // For now, include all chats
      });

      // Count interactions by profile type
      const profileCounts: Record<string, number> = {
        happy: 0,
        confused: 0,
        angry: 0,
      };

      // Group by profile
      classChats.forEach((chat) => {
        const profile = profiles?.find(p => p.id === chat.profileId);
        if (!profile) return;
        
        const profileName = profile.name.toLowerCase();
        // Map 'aggressive' to 'angry' for the UI
        const uiProfile = profileName === "aggressive" ? "angry" : profileName;

        if (profileCounts[uiProfile] !== undefined) {
          profileCounts[uiProfile]++;
        }
      });

      // Calculate percentages
      const total = classChats.length || 1; // Avoid division by zero
      const happy = Math.round((profileCounts.happy / total) * 100);
      const confused = Math.round((profileCounts.confused / total) * 100);
      const angry = Math.round((profileCounts.angry / total) * 100);

      return [
        { emotion: "Happy", value: happy, fill: "#10b981" },
        { emotion: "Confused", value: confused, fill: "#f59e0b" },
        { emotion: "Angry", value: angry, fill: "#ef4444" },
      ];
    }, [chats, profiles]);

    return (
      <div className="space-y-6">
        {/* Performance Trend Charts */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
            <CardDescription>
              TA performance metrics and student emotional data for {classData.classCode}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Line Chart - Score Trends */}
            <div className="h-80">
              <h3 className="text-sm font-medium mb-2">
                Average Score Trend
              </h3>
              <ResponsiveContainer width="100%" height="90%">
                <LineChart data={scoreTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" axisLine={true} tickLine={true} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="avgScore"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Avg. Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart - Student Emotions */}
            <div className="h-80">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium">
                  Student Emotional Response
                </h3>
                <div className="flex items-center bg-secondary rounded-md p-0.5">
                  <button
                    onClick={() => setActiveEmotion("happy")}
                    className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
                      activeEmotion === "happy"
                        ? "bg-background shadow"
                        : "hover:bg-secondary-foreground/10"
                    }`}
                  >
                    Happy
                  </button>
                  <button
                    onClick={() => setActiveEmotion("confused")}
                    className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
                      activeEmotion === "confused"
                        ? "bg-background shadow"
                        : "hover:bg-secondary-foreground/10"
                    }`}
                  >
                    Confused
                  </button>
                  <button
                    onClick={() => setActiveEmotion("angry")}
                    className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
                      activeEmotion === "angry"
                        ? "bg-background shadow"
                        : "hover:bg-secondary-foreground/10"
                    }`}
                  >
                    Angry
                  </button>
                </div>
              </div>

              <div className="h-[calc(100%-24px)]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart
                    data={emotionData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    barGap={0}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="emotion" axisLine={true} tickLine={true} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    {activeEmotion === "happy" && (
                      <Bar
                        dataKey="value"
                        name="Happy"
                        fill="#10b981"
                        minPointSize={3}
                        isAnimationActive={true}
                      />
                    )}
                    {activeEmotion === "confused" && (
                      <Bar
                        dataKey="value"
                        name="Confused"
                        fill="#f59e0b"
                        minPointSize={3}
                        isAnimationActive={true}
                      />
                    )}
                    {activeEmotion === "angry" && (
                      <Bar
                        dataKey="value"
                        name="Angry"
                        fill="#ef4444"
                        minPointSize={3}
                        isAnimationActive={true}
                      />
                    )}
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents Section */}
        <Card>
          <CardHeader>
            <CardTitle>Class Documents</CardTitle>
            <CardDescription>
              Upload and manage documents for {classData.classCode}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Documents classId={classData.id} />
          </CardContent>
        </Card>
      </div>
    );
  };

  // Chat Profiles Content Component
  const ChatProfilesContent = () => {
    const [showCreateProfile, setShowCreateProfile] = useState(false);
    const [newProfile, setNewProfile] = useState({ name: "", subtitle: "", description: "", threshold: 50 });

    const handleCreateProfile = async () => {
      // Mock API call - replace with actual implementation
      toast.success("Profile created successfully!");
      setShowCreateProfile(false);
      setNewProfile({ name: "", subtitle: "", description: "", threshold: 50 });
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Chat Profiles</h2>
            <p className="text-muted-foreground">Manage AI student personality profiles</p>
          </div>
          <Button onClick={() => setShowCreateProfile(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Profile
          </Button>
        </div>

        <div className="grid gap-4">
          {profiles?.map((profile: any) => (
            <Card key={profile.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{profile.name}</CardTitle>
                    <CardDescription>{profile.subtitle}</CardDescription>
                    <p className="text-sm text-muted-foreground">{profile.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">Threshold: {profile.threshold}%</Badge>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Create Profile Dialog */}
        <Dialog open={showCreateProfile} onOpenChange={setShowCreateProfile}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profileName">Profile Name</Label>
                <Input
                  id="profileName"
                  value={newProfile.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProfile(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Enthusiastic"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profileSubtitle">Subtitle</Label>
                <Input
                  id="profileSubtitle"
                  value={newProfile.subtitle}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProfile(prev => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="Brief description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profileDescription">Description</Label>
                <Textarea
                  id="profileDescription"
                  value={newProfile.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewProfile(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed behavior description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profileThreshold">Threshold (%)</Label>
                <Input
                  id="profileThreshold"
                  type="number"
                  min="0"
                  max="100"
                  value={newProfile.threshold}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProfile(prev => ({ ...prev, threshold: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateProfile(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateProfile}>
                  Create Profile
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  // Chat Scenarios Content Component
  const ChatScenariosContent = () => {
    const [scenarios, setScenarios] = useState([
      { id: "1", name: "Office Hours", description: "Student seeking help during office hours", difficulty: "Easy" },
      { id: "2", name: "Exam Preparation", description: "Student preparing for upcoming exam", difficulty: "Medium" },
      { id: "3", name: "Project Confusion", description: "Student confused about project requirements", difficulty: "Hard" },
    ]);

    const [showCreateScenario, setShowCreateScenario] = useState(false);
    const [newScenario, setNewScenario] = useState({ name: "", description: "", difficulty: "Easy" });

    const handleCreateScenario = () => {
      const scenario = { ...newScenario, id: Date.now().toString() };
      setScenarios(prev => [...prev, scenario]);
      setShowCreateScenario(false);
      setNewScenario({ name: "", description: "", difficulty: "Easy" });
      toast.success("Scenario created successfully!");
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Chat Scenarios</h2>
            <p className="text-muted-foreground">Manage conversation scenarios for AI students</p>
          </div>
          <Button onClick={() => setShowCreateScenario(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Scenario
          </Button>
        </div>

        <div className="grid gap-4">
          {scenarios.map((scenario) => (
            <Card key={scenario.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{scenario.name}</CardTitle>
                    <CardDescription>{scenario.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={scenario.difficulty === "Easy" ? "default" : scenario.difficulty === "Medium" ? "secondary" : "destructive"}>
                      {scenario.difficulty}
                    </Badge>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Create Scenario Dialog */}
        <Dialog open={showCreateScenario} onOpenChange={setShowCreateScenario}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Scenario</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scenarioName">Scenario Name</Label>
                <Input
                  id="scenarioName"
                  value={newScenario.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewScenario(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Office Hours"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scenarioDescription">Description</Label>
                <Textarea
                  id="scenarioDescription"
                  value={newScenario.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewScenario(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the scenario context"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scenarioDifficulty">Difficulty</Label>
                <Select
                  value={newScenario.difficulty}
                  onValueChange={(value) => setNewScenario(prev => ({ ...prev, difficulty: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Easy">Easy</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateScenario(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateScenario}>
                  Create Scenario
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  // Student Management Content Component
  const StudentManagementContent = () => {
    const [students] = useState([
      { id: "1", name: "John Doe", email: "redacted@purdue.edu", interactions: 15, avgScore: 85 },
      { id: "2", name: "Jane Smith", email: "redacted@purdue.edu", interactions: 23, avgScore: 92 },
      { id: "3", name: "Bob Johnson", email: "redacted@purdue.edu", interactions: 8, avgScore: 78 },
    ]);

    const [downloadingReports, setDownloadingReports] = useState<Record<string, boolean>>({});
    const [isUploadingCSV, setIsUploadingCSV] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
        toast.error("Please upload a valid CSV file");
        return;
      }

      try {
        setIsUploadingCSV(true);
        setUploadProgress(0);

        const toastId = toast.loading("Uploading CSV file...");

        // Generate a unique file ID
        const fileId = crypto.randomUUID();

        // Get the API URL from environment
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

        const tusMetadata = {
          filename: file.name,
          filetype: file.type,
          csv: "true", // Mark this as a CSV upload
          fileId: fileId,
        };

        // Create a new tus upload
        const upload = new (await import("tus-js-client")).Upload(file, {
          endpoint: `${apiUrl}/documents/tus`,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          metadata: tusMetadata,
          onError: (error) => {
            console.error(`Failed to upload ${file.name}: `, error);
            toast.dismiss(toastId);
            toast.error(`Failed to upload ${file.name}: ${error.message || "Unknown error"}`);
            setIsUploadingCSV(false);
            setUploadProgress(0);
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
            setUploadProgress(percentage);
          },
          onSuccess: async () => {
            // Finalize the upload
            try {
              const finalizePayload = {
                fileId,
                csv: true,
              };

              console.log("CSV Finalize payload:", finalizePayload);

              const response = await fetch(
                `${apiUrl}/documents/tus/finalize`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  credentials: "include",
                  body: JSON.stringify(finalizePayload),
                },
              );

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                  errorData.message || "Failed to finalize CSV upload",
                );
              }

              toast.dismiss(toastId);
              toast.success("CSV file uploaded and processed successfully!");
              
              // Clear the file input
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }

              // Invalidate queries to refresh data
              queryClient.invalidateQueries({ queryKey: ["users"] });
              queryClient.invalidateQueries({ queryKey: ["classes"] });

            } catch (error) {
              console.error(`CSV finalization error:`, error);
              toast.dismiss(toastId);
              toast.error(
                `Failed to process CSV file: ${error instanceof Error ? error.message : "Unknown error"}`,
              );
            } finally {
              setIsUploadingCSV(false);
              setUploadProgress(0);
            }
          },
        });

        // Start the upload
        upload.start();

      } catch (error) {
        console.error("CSV upload initialization error:", error);
        toast.error(
          `Upload error: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        setIsUploadingCSV(false);
        setUploadProgress(0);
      }
    };

    const handleDownloadReport = async (student: any) => {
      try {
        setDownloadingReports(prev => ({ ...prev, [student.id]: true }));

        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 2000));

        toast.success(`Report for ${student.name} downloaded successfully`);
      } catch (error) {
        toast.error("Failed to download report");
      } finally {
        setDownloadingReports(prev => ({ ...prev, [student.id]: false }));
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Student Management</h2>
            <p className="text-muted-foreground">Manage student records and generate reports</p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCSVUpload}
              className="hidden"
              id="csv-upload"
              disabled={isUploadingCSV}
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('csv-upload')?.click()}
              disabled={isUploadingCSV}
            >
              {isUploadingCSV ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload CSV
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Upload Progress */}
        {isUploadingCSV && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    CSV Upload Progress
                  </span>
                  <span className="text-sm font-medium">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Student List</CardTitle>
            <CardDescription>
              All registered students with their interaction statistics. Upload a CSV file to add new students.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-4 border-b"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{getInitials(student.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{student.name}</p>
                      <p className="text-sm text-muted-foreground">{student.email}</p>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <UserCheck className="h-3 w-3 mr-1" />
                        <span>{student.interactions} interactions</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      className={`
                        ${student.avgScore >= 80
                          ? "bg-green-100 text-green-800"
                          : student.avgScore >= 70
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                        }
                      `}
                    >
                      Score: {student.avgScore}%
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadReport(student)}
                      disabled={downloadingReports[student.id]}
                    >
                      {downloadingReports[student.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <SidebarProvider>
      <AdminSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />
      <SidebarInset>
        {/* Render all modals */}
        <AddCourseModal />

        {/* Header */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">{getPageTitle()}</h1>
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
        </header>

        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-4 p-4">
          {renderContent()}
        </div>

        <Dialog open={showRubric} onOpenChange={setShowRubric}>
          <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Rubric</DialogTitle>
            </DialogHeader>
            <Rubric />
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
