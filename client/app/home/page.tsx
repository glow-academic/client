/**
 * app/home/page.tsx
 * This is the home page to open new chats and look at existing chats
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
"use client";
import { getUser } from "@/utils/queries/get-user";
import { useTaskColumns } from "@/components/tasks/columns";
import { DataTable } from "@/components/tasks/data-table";
import { UserNav } from "@/components/tasks/user-nav";
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
import { Calendar, Shuffle, Zap, SmilePlus, HelpCircle, Timer } from "lucide-react";
import { getChats } from "@/utils/queries/get-chats";
import { getRubrics } from "@/utils/queries/get-rubrics";
import { useRouter } from "next/navigation";
import { chatProfile } from "@/drizzle/schema";
import { useState } from "react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { getClasses } from "@/utils/queries/get-classes";
import { getQuizzesForUser } from "@/utils/queries/get-quizzes";

export default function Home() {
  const isAdmin = false;
  const { columns, data, isLoading, userOptions, classOptions } =
    useTaskColumns({ isAdmin: isAdmin });
  const router = useRouter();
  const [loadingProfile, setLoadingProfile] = useState<string | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(),
  });

  const { data: chats } = useQuery({
    queryKey: ["chats"],
    queryFn: () => getChats(user!.id),
    enabled: !!user,
  });

  const { data: rubrics, isLoading: rubricsLoading } = useQuery({
    queryKey: ["rubrics", chats?.map((chat) => chat.id)],
    queryFn: () => getRubrics(chats!.map((chat) => chat.id)),
    enabled: !!chats,
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getClasses(),
  });

  // Fetch quizzes from database for this user
  const { data: quizzes = [], isLoading: quizzesLoading } = useQuery({
    queryKey: ["quizzes"],
    queryFn: async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/quiz`, {
          credentials: "include",
        });
        
        if (!response.ok) {
          if (response.status === 405) {
            // Method not allowed, endpoint might not exist yet
            console.warn("Quiz endpoint not implemented yet");
            return [];
          }
          throw new Error("Failed to fetch quizzes");
        }
        
        const data = await response.json();
        
        // Filter quizzes that the user has access to (based on their classes)
        if (!user?.classes || user.classes.length === 0) {
          return data; // Show all quizzes if user has no specific classes
        }
        
        return data.filter((quiz: any) => 
          user.classes.includes(quiz.classId)
        );
      } catch (error) {
        console.error("Error fetching quizzes:", error);
        return [];
      }
    },
    enabled: !!user, // Only fetch when user data is available
  });

  const handleStartChat = async (
    profile: (typeof chatProfile.enumValues)[number] | "shuffle",
  ) => {
    try {
      if (!user) {
        toast.error("User not found. Please log in again.");
        return;
      }

      if (!classes) {
        toast.error("No classes found. Please contact an administrator.");
        return;
      }

      setLoadingProfile(profile);
      toast.loading(`Starting ${profile} chat...`);

      // If shuffle is selected, determine which profile needs the most help
      let selectedProfile = profile;
      if (profile === "shuffle" && rubrics && chats) {
        selectedProfile =
          selectProfileNeedingMostHelp() as (typeof chatProfile.enumValues)[number];
      }

      // randomly select a class from the user's classes if they have any, otherwise pick from classes
      const classId =
        user.classes.length > 0
          ? user.classes[Math.floor(Math.random() * user.classes.length)]
          : classes[Math.floor(Math.random() * classes.length)].id;

      const formData = new FormData();
      formData.append("profile", selectedProfile);
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
        toast.success(`Started ${selectedProfile} chat`);
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
  const selectProfileNeedingMostHelp = () => {
    if (!rubrics || !chats) return "confused"; // Default fallback

    // Calculate average scores for each profile type
    const profileScores = {
      aggressive: { totalScore: 0, count: 0 },
      happy: { totalScore: 0, count: 0 },
      confused: { totalScore: 0, count: 0 },
    };

    // Group chats by profile
    const chatsByProfile = {
      aggressive: chats.filter((chat) => chat.profile === "aggressive"),
      happy: chats.filter((chat) => chat.profile === "happy"),
      confused: chats.filter((chat) => chat.profile === "confused"),
    };

    // Calculate scores for each profile
    Object.entries(chatsByProfile).forEach(([profile, profileChats]) => {
      profileChats.forEach((chat) => {
        const chatRubric = rubrics.find((r) => r.chatId === chat.id);
        if (chatRubric) {
          profileScores[profile as keyof typeof profileScores].totalScore +=
            chatRubric.score;
          profileScores[profile as keyof typeof profileScores].count++;
        }
      });
    });

    // Find profiles that haven't passed (score < 17)
    const failingProfiles = Object.entries(profileScores)
      .filter(([_, stats]) => stats.count > 0) // Only include profiles with at least one chat
      .map(([profile, stats]) => {
        const avgScore = stats.count > 0 ? stats.totalScore / stats.count : 0;
        return { profile, avgScore };
      })
      .filter((p) => p.avgScore < 17); // Filter for failing scores

    if (failingProfiles.length === 0) {
      // If all profiles are passing, pick the lowest scoring one
      const lowestScoringProfile = Object.entries(profileScores)
        .filter(([_, stats]) => stats.count > 0)
        .map(([profile, stats]) => {
          const avgScore = stats.count > 0 ? stats.totalScore / stats.count : 0;
          return { profile, avgScore };
        })
        .sort((a, b) => a.avgScore - b.avgScore)[0];

      return lowestScoringProfile?.profile || "confused";
    }

    // Randomly select from failing profiles
    const randomIndex = Math.floor(Math.random() * failingProfiles.length);
    return failingProfiles[randomIndex].profile;
  };

  if (isLoading) {
    return (
      <div className="hidden h-full flex-1 flex-col space-y-8 p-8 md:flex">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
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

  // Calculate rubric scores and progress for each profile
  // Each criterion (adaptability, listening, etc.) has a max score of 5
  // Total passing score is 17/20 (85%)
  const profileMetrics = {
    shuffle: { score: 0, progress: 0 },
    aggressive: { score: 0, progress: 0 },
    happy: { score: 0, progress: 0 },
    confused: { score: 0, progress: 0 },
  };

  if (rubrics && chats) {
    // Group chats by profile
    const chatsByProfile = {
      aggressive: chats.filter((chat) => chat.profile === "aggressive"),
      happy: chats.filter((chat) => chat.profile === "happy"),
      confused: chats.filter((chat) => chat.profile === "confused"),
    };

    // Calculate scores for each profile
    Object.entries(chatsByProfile).forEach(([profile, profileChats]) => {
      if (profileChats.length === 0) return;

      let maxScore = 0;
      let totalScore = 0;
      let chatCount = 0;

      // Track individual criteria scores to determine proficiency
      let adaptabilitySum = 0;
      let listeningSum = 0;
      let objectivesSum = 0;
      let timeManagementSum = 0;

      profileChats.forEach((chat) => {
        const chatRubric = rubrics.find((r) => r.chatId === chat.id);
        if (chatRubric) {
          // Keep track of max score for this profile
          maxScore = Math.max(maxScore, chatRubric.score);
          // Still calculate total for shuffle average
          totalScore += chatRubric.score;
          adaptabilitySum += chatRubric.adaptability;
          listeningSum += chatRubric.listening;
          objectivesSum += chatRubric.objectives;
          timeManagementSum += chatRubric.timeManagement;
          chatCount++;
        }
      });

      if (chatCount > 0) {
        // Use maximum score for individual profiles (out of 20)
        const progress = Math.min(100, Math.round((maxScore / 17) * 100));

        profileMetrics[profile as keyof typeof profileMetrics] = {
          score: Math.round(maxScore * 10) / 10, // Round to 1 decimal place
          progress,
        };
      }
    });

    // Calculate shuffle metrics (average of all profiles)
    const activeProfiles = Object.entries(profileMetrics).filter(
      ([key, _]) =>
        key !== "shuffle" &&
        profileMetrics[key as keyof typeof profileMetrics].score > 0,
    ).length;

    if (activeProfiles > 0) {
      // For shuffle, we still use average across all chats
      let totalScoreAll = 0;
      let totalCountAll = 0;

      Object.entries(chatsByProfile).forEach(([profile, profileChats]) => {
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

  // Handle starting a quiz
  const handleStartQuiz = async (quizId: string) => {
    try {
      if (!user) {
        toast.error("User not found. Please log in again.");
        return;
      }

      setLoadingQuiz(true);
      toast.loading("Starting quiz...");

      // Navigate directly to the quiz page
      toast.dismiss();
      toast.success("Quiz started");
      router.push(`/quiz/${quizId}`);
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

  return (
    <div className="hidden h-full flex-1 flex-col space-y-8 p-8 md:flex">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome{user?.viewedIntro ? " back" : ""}, {user?.name}!
          </h2>
          <p className="text-muted-foreground">
            Click the different chat profiles to get started.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <UserNav />
        </div>
      </div>

      {/* Chat Profile Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        ) : quizzes.length > 0 ? (
          quizzes.map(quiz => {
            // Find class for this quiz
            const quizClass = classes?.find(c => c.id === quiz.classId);
            
            return (
              <Card
                key={quiz.id}
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
                  <CardDescription>{quizClass?.classCode || "Unknown"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium">{quiz.title}</p>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground flex justify-between items-center">
                  <div className="flex items-center">
                    <Timer className="h-3 w-3 mr-1" />
                    <span>{quiz.timeLimit} min</span>
                  </div>
                  <span className="font-medium">Click to start</span>
                </CardFooter>
              </Card>
            );
          })
        ) : null}
        
        {/* Shuffle Card */}
        <Card
          className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${loadingProfile ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
          onClick={() => !loadingProfile && handleStartChat("shuffle")}
        >
          <div
            className="absolute inset-0 bg-gradient-to-r from-violet-500 to-blue-500 opacity-30"
            style={{ width: `${profileMetrics.shuffle.progress}%` }}
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
            <span>Score: {profileMetrics.shuffle.score}/20</span>
            <span
              className={
                profileMetrics.shuffle.score >= 17
                  ? "text-green-600 font-medium"
                  : "text-amber-600"
              }
            >
              {profileMetrics.shuffle.score >= 17 ? "PASS" : `85% to pass`}
            </span>
          </CardFooter>
        </Card>

        {/* Aggressive Card */}
        <Card
          className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${loadingProfile ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
          onClick={() => !loadingProfile && handleStartChat("aggressive")}
        >
          <div
            className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 opacity-30"
            style={{ width: `${profileMetrics.aggressive.progress}%` }}
          ></div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap
                className={`h-5 w-5 text-red-500 ${loadingProfile === "aggressive" ? "animate-spin" : "group-hover:scale-125 transition-transform duration-300"}`}
              />
              Aggressive
            </CardTitle>
            <CardDescription>Direct and challenging</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Pushes back on your ideas and challenges assumptions.
            </p>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground flex justify-between">
            <span>Score: {profileMetrics.aggressive.score}/20</span>
            <span
              className={
                profileMetrics.aggressive.score >= 17
                  ? "text-green-600 font-medium"
                  : "text-amber-600"
              }
            >
              {profileMetrics.aggressive.score >= 17 ? "PASS" : `85% to pass`}
            </span>
          </CardFooter>
        </Card>

        {/* Happy Card */}
        <Card
          className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${loadingProfile ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
          onClick={() => !loadingProfile && handleStartChat("happy")}
        >
          <div
            className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 opacity-30"
            style={{ width: `${profileMetrics.happy.progress}%` }}
          ></div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SmilePlus
                className={`h-5 w-5 text-green-500 ${loadingProfile === "happy" ? "animate-spin" : "group-hover:animate-pulse transition-all duration-300"}`}
              />
              Happy
            </CardTitle>
            <CardDescription>Positive and encouraging</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Provides uplifting feedback and cheerful responses.
            </p>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground flex justify-between">
            <span>Score: {profileMetrics.happy.score}/20</span>
            <span
              className={
                profileMetrics.happy.score >= 17
                  ? "text-green-600 font-medium"
                  : "text-amber-600"
              }
            >
              {profileMetrics.happy.score >= 17 ? "PASS" : `85% to pass`}
            </span>
          </CardFooter>
        </Card>

        {/* Confused Card */}
        <Card
          className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${loadingProfile ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
          onClick={() => !loadingProfile && handleStartChat("confused")}
        >
          <div
            className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-amber-500 opacity-30"
            style={{ width: `${profileMetrics.confused.progress}%` }}
          ></div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle
                className={`h-5 w-5 text-yellow-500 ${loadingProfile === "confused" ? "animate-spin" : "group-hover:rotate-12 transition-transform duration-300"}`}
              />
              Confused
            </CardTitle>
            <CardDescription>Asks clarifying questions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Seeks to understand by asking questions and exploring ideas.
            </p>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground flex justify-between">
            <span>Score: {profileMetrics.confused.score}/20</span>
            <span
              className={
                profileMetrics.confused.score >= 17
                  ? "text-green-600 font-medium"
                  : "text-amber-600"
              }
            >
              {profileMetrics.confused.score >= 17 ? "PASS" : `85% to pass`}
            </span>
          </CardFooter>
        </Card>
      </div>

      {/* Separator between Profiles and History */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center">
          <div className="bg-background px-4 text-sm text-muted-foreground">
            Chat History
          </div>
        </div>
      </div>

      <DataTable
        data={data || []}
        columns={columns}
        userOptions={userOptions}
        classOptions={classOptions}
        isAdmin={isAdmin}
      />
    </div>
  );
}
