/**
 * Courses.tsx
 * Used to display courses for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */

import { getClasses } from "@/utils/queries/get-classes";
import { getUsers } from "@/utils/queries/get-users";
import { getAllChats } from "@/utils/queries/get-all-chats";
import { getDocuments } from "@/utils/queries/get-documents";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ChevronRight, BookOpen, FileSpreadsheet } from "lucide-react";

interface CourseWithStats {
  id: string;
  classCode: string;
  name: string;
  description: string;
  taCount: number;
  chatCount: number;
  csvStudentCount: number;
  createdAt: string;
}

export default function Courses() {
  const router = useRouter();

  // Fetch users
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });

  // Fetch classes (courses)
  const { data: classes, isLoading: isLoadingClasses } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getClasses(),
  });

  // Fetch chats
  const { data: chats, isLoading: isLoadingChats } = useQuery({
    queryKey: ["all-chats"],
    queryFn: () => getAllChats(),
  });

  // Fetch documents to check for CSV files
  const { data: documents, isLoading: isLoadingDocuments } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getDocuments(),
  });

  // Calculate TA count (non-admin users)
  const teachingAssistants = useMemo(() => {
    if (!users) return [];
    return users.filter((user) => !user.admin);
  }, [users]);

  const handleCourseClick = (course: CourseWithStats) => {
    router.push(`/admin/classes/${course.id}`);
  };

  // Calculate course statistics including CSV students
  const coursesWithStats = useMemo<CourseWithStats[]>(() => {
    if (!classes || !users || !chats || !documents) return [];

    return classes.map((course) => {
      // Count TAs assigned to this course
      const assignedTAs = users.filter(
        (user) =>
          !user.admin && user.classes && user.classes.includes(course.id),
      ).length;

      // Count chats for this course
      const courseChats = chats.filter(
        (chat) => chat.classId === course.id,
      ).length;

      // Count CSV files for this course (student rosters)
      const csvFiles = documents.filter(
        (doc) =>
          doc.classId === course.id &&
          doc.name.toLowerCase().endsWith(".csv"),
      );

      // More realistic student count - show number of CSV files uploaded, not estimated students
      const csvStudentCount = csvFiles.length;

      return {
        id: course.id,
        classCode: course.classCode,
        name: course.name,
        description: course.description,
        taCount: assignedTAs,
        chatCount: courseChats,
        csvStudentCount,
        createdAt: course.createdAt,
      };
    });
  }, [classes, users, chats, documents]);

  // Loading state
  if (isLoadingUsers || isLoadingClasses || isLoadingChats || isLoadingDocuments) {
    return (
      <div className="flex justify-center items-center p-10">
        Loading courses...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Course Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {coursesWithStats.map((course) => (
          <Card
            key={course.id}
            className="transition-all hover:shadow-md cursor-pointer hover:border-primary/50"
            onClick={() => handleCourseClick(course)}
          >
            <CardHeader>
              <div className="flex items-center justify-between mb-1">
                <Badge variant="outline" className="font-medium">
                  {course.classCode}
                </Badge>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <CardTitle className="mt-2">{course.name}</CardTitle>
              <CardDescription>{course.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center text-sm">
                  <Users className="h-4 w-4 mr-1 text-muted-foreground" />
                  <span>
                    <strong>{course.taCount}</strong> TAs
                  </span>
                </div>
                <div className="flex items-center text-sm">
                  <BookOpen className="h-4 w-4 mr-1 text-muted-foreground" />
                  <span>
                    <strong>{course.chatCount}</strong> Chats
                  </span>
                </div>
                <div className="flex items-center text-sm col-span-2">
                  <FileSpreadsheet className="h-4 w-4 mr-1 text-muted-foreground" />
                  <span>
                    <strong>{course.csvStudentCount}</strong> Student Rosters
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Course Management Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Course Management</CardTitle>
          <CardDescription>
            Overview of active courses and teaching assistant allocations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-green-500"></div>
                <span className="font-medium">Total Courses</span>
              </div>
              <span className="font-bold">{coursesWithStats.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-blue-500"></div>
                <span className="font-medium">Total Teaching Assistants</span>
              </div>
              <span className="font-bold">{teachingAssistants.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-purple-500"></div>
                <span className="font-medium">Total Interactions</span>
              </div>
              <span className="font-bold">{chats?.length || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-orange-500"></div>
                <span className="font-medium">Student Roster Files</span>
              </div>
              <span className="font-bold">
                {coursesWithStats.reduce(
                  (sum, course) => sum + course.csvStudentCount,
                  0,
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
