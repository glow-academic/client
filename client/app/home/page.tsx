/**
 * app/home/page.tsx
 * This is the unified home page with role-based access control
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
"use client";
import { getUser } from "@/utils/queries/get-user";
import { useTaskColumns } from "@/components/tasks/columns";
import { DataTable } from "@/components/tasks/data-table";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Shuffle, Timer } from "lucide-react";
import { getChats } from "@/utils/queries/get-chats";
import { getRubrics } from "@/utils/queries/get-rubrics";
import { useRouter } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { getClasses } from "@/utils/queries/get-classes";
import { getProfiles } from "@/utils/queries/get-profiles";
import { getQuizzes } from "@/utils/queries/get-quizzes";
import { getProfileConfig, getProfileDescription } from "@/utils/profiles";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { UnifiedSidebar } from "@/components/unified-sidebar";
import Analytics from "@/components/Analytics";
import Documents from "@/components/Documents";
import Quiz from "@/components/Quiz";

// Import admin content components
import { getAllChats } from "@/utils/queries/get-all-chats";
import { getClass } from "@/utils/queries/get-class";
import { ChatProfilesContent } from "@/components/admin/chat-profiles-content";
import { ChatScenariosContent } from "@/components/admin/chat-scenarios-content";
import { StudentManagementContent } from "@/components/admin/student-management-content";
import { ClassDetailsContent } from "@/components/admin/class-details-content";

type UserRole = 'admin' | 'instructional' | 'instructor' | 'ta' | 'guest'

export default function Home() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("home");
  const [loadingProfile, setLoadingProfile] = useState<string | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  // Handle URL parameters for direct navigation
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section');
    if (section) {
      setActiveSection(section);
      // Clean up URL without triggering a reload
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(),
  });

  // Get user role simulation - moved after user query
  const getEffectiveRole = (): UserRole => {
    // Check if in guest mode from localStorage
    const isGuestMode = localStorage.getItem('guestMode') === 'true';
    if (isGuestMode && !user) return 'guest';
    
    if (!user) return 'guest';
    const stored = localStorage.getItem('simulatedRole');
    if (user.role === 'admin' && stored && ['admin', 'instructional', 'instructor', 'ta', 'guest'].includes(stored)) {
      return stored as UserRole;
    }
    return (user.role as UserRole) || 'guest';
  };

  const effectiveRole = getEffectiveRole();
  const isAdmin = ['admin', 'instructional'].includes(effectiveRole);

  const { columns, data, isLoading, userOptions, classOptions } =
    useTaskColumns({ isAdmin });

  const { data: chats } = useQuery({
    queryKey: ["chats", user?.id],
    queryFn: () => getChats(user!.id),
    enabled: !!user && effectiveRole !== 'guest',
  });

  const { data: rubrics, isLoading: rubricsLoading } = useQuery({
    queryKey: ["rubrics", chats?.map((chat) => chat.id)],
    queryFn: () => getRubrics(chats!.map((chat) => chat.id)),
    enabled: !!chats && effectiveRole !== 'guest' && !!user,
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getClasses(),
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getProfiles(),
  });

  const { data: quizzes, isLoading: quizzesLoading } = useQuery({
    queryKey: ["quizzes", user?.id],
    queryFn: () => getQuizzes(user?.classIds || []),
    enabled: !!user && effectiveRole !== 'guest'
  });

  // Extract class ID from active section if it's a class section
  const currentClassId = activeSection.startsWith("class-") ? activeSection.replace("class-", "") : null;

  // Fetch specific class data when viewing a class
  const { data: classDataArray } = useQuery({
    queryKey: ["class", currentClassId],
    queryFn: () => getClass(currentClassId!),
    enabled: !!currentClassId && isAdmin,
  });

  const classData = useMemo(() => {
    return Array.isArray(classDataArray) ? classDataArray[0] : classDataArray;
  }, [classDataArray]);

  // Fetch all chats for admin views
  const { data: allChats } = useQuery({
    queryKey: ["all-chats"],
    queryFn: () => getAllChats(),
    enabled: !!currentClassId && isAdmin && !!user,
  });

  // Fetch all rubrics for admin views
  const { data: allRubrics } = useQuery({
    queryKey: ["all-rubrics"],
    queryFn: () => getRubrics(allChats!.map((chat) => chat.id)),
    enabled: !!allChats && allChats.length > 0 && isAdmin && !!user,
  });

  const handleStartQuiz = async (quizId: string, profileId?: string) => {
    try {
      if (!user) {
        toast.error("User not found. Please log in again.");
        return;
      }

      if (!classes) {
        toast.error("No classes found. Please contact an administrator.");
        return;
      }

      setLoadingQuiz(true);
      toast.loading("Starting quiz...");

      // If no profile specified, randomly select one from available profiles
      let selectedProfileId = profileId;
      if (!selectedProfileId && profiles && profiles.length > 0) {
        selectedProfileId = profiles[Math.floor(Math.random() * profiles.length)].id;
      }

      // randomly select a class from the user's classes if they have any, otherwise pick from classes
      const classId =
        user.classIds.length > 0
          ? user.classIds[Math.floor(Math.random() * user.classIds.length)]
          : classes[Math.floor(Math.random() * classes.length)].id;

      const formData = new FormData();
      if (selectedProfileId) {
        formData.append("profile_id", selectedProfileId);
      }
      formData.append("user_id", user.id);
      formData.append("class_id", classId);
      formData.append("quiz_id", quizId);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/quiz/start`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (response.ok) {
        const data = await response.json();
        toast.dismiss();
        toast.success("Quiz started");
        router.push(`/quiz/${quizId}`);
      } else {
        throw new Error(response.statusText || "Failed to start quiz");
      }
    } catch (error) {
      console.error("Error starting quiz:", error);
      toast.dismiss();
      toast.error(
        `Failed to start quiz: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoadingQuiz(false);
    }
  };

  const handleStartChat = async (profileId: string) => {
    try {
      // Handle guest mode
      if (effectiveRole === 'guest' && !user) {
        // For guests, we'll use a simplified approach
        const profile = profiles?.find(p => p.id === profileId);
        const profileName = profile?.name || "Unknown";
        toast.loading(`Starting ${profileName} chat...`);

        // Create a guest chat session
        const formData = new FormData();
        formData.append("profile_id", profileId);
        formData.append("user_id", "guest"); // Use "guest" as user ID
        formData.append("class_id", classes?.[0]?.id || "default"); // Use first available class or default

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/chat/new`,
          {
            method: "POST",
            body: formData,
          },
        );

        if (response.ok) {
          const data = await response.json();
          toast.dismiss();
          toast.success(`Started ${profileName} chat`);
          router.push(`/chat/${data.chat_id}`);
        } else {
          throw new Error(response.statusText || "Failed to create chat");
        }
        return;
      }

      if (!user) {
        toast.error("User not found. Please log in again.");
        return;
      }

      if (!classes) {
        toast.error("No classes found. Please contact an administrator.");
        return;
      }

      if (!profiles) {
        toast.error("No profiles found. Please contact an administrator.");
        return;
      }

      setLoadingProfile(profileId);
      
      // Find the profile name for the toast message
      const profile = profiles.find(p => p.id === profileId);
      const profileName = profile?.name || "Unknown";
      toast.loading(`Starting ${profileName} chat...`);

      // If shuffle is selected, determine which profile needs the most help
      let selectedProfileId = profileId;
      if (profileName.toLowerCase() === "shuffle" && rubrics && chats) {
        const needsHelpProfile = selectProfileNeedingMostHelp();
        if (needsHelpProfile) {
          selectedProfileId = needsHelpProfile;
        }
      }

      // randomly select a class from the user's classes if they have any, otherwise pick from classes
      const classId =
        user.classIds.length > 0
          ? user.classIds[Math.floor(Math.random() * user.classIds.length)]
          : classes[Math.floor(Math.random() * classes.length)].id;

      const formData = new FormData();
      formData.append("profile_id", selectedProfileId);
      formData.append("user_id", user.id);
      formData.append("class_id", classId);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/chat/new`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (response.ok) {
        const data = await response.json();
        toast.dismiss();
        toast.success(`Started ${profileName} chat`);
        router.push(`/chat/${data.chat_id}`);
      } else {
        throw new Error(response.statusText || "Failed to create chat");
      }
    } catch (error) {
      console.error("Error creating chat:", error);
      toast.dismiss();
      toast.error(
        `Failed to start chat: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoadingProfile(null);
    }
  };

  // Function to select the profile that needs the most help based on rubrics
  const selectProfileNeedingMostHelp = (): string | null => {
    if (!rubrics || !chats || !profiles) return null;

    // Calculate average scores for each profile type
    const profileScores: Record<string, { totalScore: number; count: number }> = {};
    
    // Initialize profile scores
    profiles.forEach(profile => {
      profileScores[profile.id] = { totalScore: 0, count: 0 };
    });

    // Group chats by profile
    const chatsByProfile: Record<string, typeof chats> = {};
    profiles.forEach(profile => {
      chatsByProfile[profile.id] = chats.filter((chat) => chat.profileId === profile.id);
    });

    // Calculate scores for each profile
    Object.entries(chatsByProfile).forEach(([profileId, profileChats]) => {
      profileChats.forEach((chat) => {
        const chatRubric = rubrics.find((r) => r.chatId === chat.id);
        if (chatRubric) {
          profileScores[profileId].totalScore += chatRubric.score;
          profileScores[profileId].count++;
        }
      });
    });

    // Find profiles that haven't passed (score < 17)
    const failingProfiles = Object.entries(profileScores)
      .filter(([_, stats]) => stats.count > 0) // Only include profiles with at least one chat
      .map(([profileId, stats]) => {
        const avgScore = stats.count > 0 ? stats.totalScore / stats.count : 0;
        return { profileId, avgScore };
      })
      .filter((p) => p.avgScore < 17); // Filter for failing scores

    if (failingProfiles.length === 0) {
      // If all profiles are passing, pick the lowest scoring one
      const lowestScoringProfile = Object.entries(profileScores)
        .filter(([_, stats]) => stats.count > 0)
        .map(([profileId, stats]) => {
          const avgScore = stats.count > 0 ? stats.totalScore / stats.count : 0;
          return { profileId, avgScore };
        })
        .sort((a, b) => a.avgScore - b.avgScore)[0];

      return lowestScoringProfile?.profileId || null;
    }

    // Randomly select from failing profiles
    const randomIndex = Math.floor(Math.random() * failingProfiles.length);
    return failingProfiles[randomIndex].profileId;
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
    return "GLOW";
  };

  // Calculate rubric scores and progress for each profile dynamically
  // Each criterion (adaptability, listening, etc.) has a max score of 5
  // Total passing score is 17/20 (85%)
  const profileMetrics: Record<string, { score: number; progress: number }> = {};

  // Initialize metrics for all profiles
  if (profiles) {
    profiles.forEach(profile => {
      profileMetrics[profile.id] = { score: 0, progress: 0 };
    });

    // Add shuffle profile if it doesn't exist
    profileMetrics.shuffle = { score: 0, progress: 0 };
  }

  if (rubrics && chats && profiles && effectiveRole !== 'guest') {
    // Group chats by profile
    const chatsByProfile: Record<string, typeof chats> = {};
    profiles.forEach(profile => {
      chatsByProfile[profile.id] = chats.filter((chat) => chat.profileId === profile.id);
    });

    // Calculate scores for each profile
    Object.entries(chatsByProfile).forEach(([profileId, profileChats]) => {
      if (profileChats.length === 0) return;

      let maxScore = 0;
      let totalScore = 0;
      let chatCount = 0;

      profileChats.forEach((chat) => {
        const chatRubric = rubrics.find((r) => r.chatId === chat.id);
        if (chatRubric) {
          // Keep track of max score for this profile
          maxScore = Math.max(maxScore, chatRubric.score);
          // Still calculate total for shuffle average
          totalScore += chatRubric.score;
          chatCount++;
        }
      });

      if (chatCount > 0) {
        // Use maximum score for individual profiles (out of 20)
        const progress = Math.min(100, Math.round((maxScore / 17) * 100));

        profileMetrics[profileId] = {
          score: Math.round(maxScore * 10) / 10, // Round to 1 decimal place
          progress,
        };
      }
    });

    // Calculate shuffle metrics (average of all profiles)
    const activeProfiles = Object.entries(profileMetrics).filter(
      ([key, _]) =>
        key !== "shuffle" &&
        profileMetrics[key].score > 0,
    ).length;

    if (activeProfiles > 0) {
      // For shuffle, we still use average across all chats
      let totalScoreAll = 0;
      let totalCountAll = 0;

      Object.entries(chatsByProfile).forEach(([profileId, profileChats]) => {
        profileChats.forEach((chat) => {
          const chatRubric = rubrics.find((r) => r.chatId === chat.id);
          if (chatRubric) {
            totalScoreAll += chatRubric.score;
            totalCountAll++;
          }
        });
      });

      if (totalCountAll > 0) {
        const avgScore = totalScoreAll / totalCountAll;
        const avgProgress = Math.min(100, Math.round((avgScore / 17) * 100));

        profileMetrics.shuffle = {
          score: Math.round(avgScore * 10) / 10,
          progress: avgProgress,
        };
      }
    }
  }

  // Render content based on active section and role
  const renderContent = () => {
    switch (activeSection) {
      case "home":
        return renderHomeContent();
      case "history":
        return renderHistoryContent();
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

  const renderHomeContent = () => {
    if (effectiveRole === 'guest') {
      // Guest view - only chat profiles
      return (
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Welcome to GLOW!
            </h2>
            <p className="text-muted-foreground">
              Click a chat profile to get started.
            </p>
          </div>

          {/* Chat Profile Cards for Guest */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Dynamic Profile Cards */}
            {profiles?.map(profile => {
              const profileConfig = getProfileConfig(profile.name);
              const IconComponent = profileConfig.icon;
              const colors = profileConfig.colors;

              return (
                <Card
                  key={profile.id}
                  className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${loadingProfile ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                  onClick={() => !loadingProfile && handleStartChat(profile.id)}
                >
                  <div className={`absolute inset-0 bg-gradient-to-r ${colors.gradient} opacity-30`}></div>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconComponent
                        className={`h-5 w-5 ${colors.iconColor} ${loadingProfile === profile.id ? "animate-spin" : "group-hover:scale-125 transition-transform duration-300"}`}
                      />
                      {profile.name}
                    </CardTitle>
                    <CardDescription>{profile.subtitle}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      {getProfileDescription(profile.name)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      );
    }

    // Regular user view
    if (isLoading) {
      return (
        <div className="space-y-8">
          <div className="flex items-center justify-between space-y-2">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>

          {/* Skeleton for Chat Profile Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader>
                  <Skeleton className="h-6 w-32 mb-1" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-16 w-full" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-4 w-24" />
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Skeleton for DataTable */}
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Quiz Section */}
        <div data-testid="quiz-section" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Quizzes Cards - Only show if there are quizzes available */}
          {quizzesLoading ? (
            // Loading skeletons for quizzes
            <Card className="overflow-hidden">
              <CardHeader>
                <Skeleton className="h-6 w-32 mb-1" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-4 w-24" />
              </CardFooter>
            </Card>
          ) : quizzes && quizzes.length > 0 ? (
            quizzes.map(quiz => {
              // Find class for this quiz
              const quizClass = classes?.find(c => c.id === quiz.classId);

              return (
                <Card
                  key={quiz.id}
                  data-testid="quiz-card"
                  className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${loadingQuiz ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                  onClick={() => !loadingQuiz && handleStartQuiz(quiz.id)}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 opacity-30"></div>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar
                        className={`h-5 w-5 text-blue-500 ${loadingQuiz ? "animate-spin" : "group-hover:scale-110 transition-transform duration-300"}`}
                      />
                      Quiz
                    </CardTitle>
                    <CardDescription data-testid="quiz-class">{quizClass?.classCode || "Unknown"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p data-testid="quiz-title" className="text-sm font-medium">{quiz.title}</p>
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground flex justify-between items-center">
                    <div className="flex items-center" data-testid="quiz-duration">
                      <Timer className="h-3 w-3 mr-1" />
                      <span>{quiz.timeLimit} min</span>
                    </div>
                    <span className="font-medium">Click to start</span>
                  </CardFooter>
                </Card>
              );
            })
          ) : null}
        </div>

        {/* Shuffle Card */}
        <Card
          className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${loadingProfile ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
          onClick={() => !loadingProfile && handleStartChat("shuffle")}
        >
          <div
            className="absolute inset-0 bg-gradient-to-r from-violet-500 to-blue-500 opacity-30"
            style={{ width: `${profileMetrics.shuffle?.progress || 0}%` }}
          ></div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shuffle
                className={`h-5 w-5 text-violet-500 ${loadingProfile === "shuffle" ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-300"}`}
              />
              Shuffle
            </CardTitle>
            <CardDescription>Random conversation style</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Let AI choose a random personality for your conversation.
            </p>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground flex justify-between">
            <span>Score: {profileMetrics.shuffle?.score || 0}/20</span>
            <span
              className={
                (profileMetrics.shuffle?.score || 0) >= 17
                  ? "text-green-600 font-medium"
                  : "text-amber-600"
              }
            >
              {(profileMetrics.shuffle?.score || 0) >= 17 ? "PASS" : `85% to pass`}
            </span>
          </CardFooter>
        </Card>

        {/* Dynamic Profile Cards */}
        {profiles?.map(profile => {
          const profileConfig = getProfileConfig(profile.name);
          const IconComponent = profileConfig.icon;
          const colors = profileConfig.colors;
          const metrics = profileMetrics[profile.id] || { score: 0, progress: 0 };

          return (
            <Card
              key={profile.id}
              className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${loadingProfile ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
              onClick={() => !loadingProfile && handleStartChat(profile.id)}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-r ${colors.gradient} opacity-30`}
                style={{ width: `${metrics.progress}%` }}
              ></div>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconComponent
                    className={`h-5 w-5 ${colors.iconColor} ${loadingProfile === profile.id ? "animate-spin" : "group-hover:scale-125 transition-transform duration-300"}`}
                  />
                  {profile.name}
                </CardTitle>
                <CardDescription>{profile.subtitle}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {getProfileDescription(profile.name)}
                </p>
              </CardContent>
              <CardFooter className="text-xs text-muted-foreground flex justify-between">
                <span>Score: {metrics.score}/20</span>
                <span
                  className={
                    metrics.score >= 17
                      ? "text-green-600 font-medium"
                      : "text-amber-600"
                  }
                >
                  {metrics.score >= 17 ? "PASS" : `85% to pass`}
                </span>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderHistoryContent = () => {
    return (
      <div className="space-y-6">
        <DataTable
          data={data || []}
          columns={columns}
          userOptions={userOptions}
          classOptions={classOptions}
          isAdmin={isAdmin}
        />
      </div>
    );
  };

  return (
    <SidebarProvider>
      <UnifiedSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />
      <SidebarInset>
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">{getPageTitle()}</h1>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-4 p-4">
          {renderContent()}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
