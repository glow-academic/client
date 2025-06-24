/**
 * ClassStatus.tsx
 * Used to display the class status page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle,
  FileText,
  Zap,
  GraduationCap,
  RefreshCw,
  AlertCircle,
  BookOpen,
  Calendar,
  Target,
} from "lucide-react";
import { getClass } from "@/utils/queries/classes/get-class";
import { getTopicsByClass } from "@/utils/queries/topics/get-topics-by-class";
import { getSchedulesByClass } from "@/utils/queries/schedules/get-schedules-by-class";
import { getEventsBySchedules } from "@/utils/queries/events/get-events-by-schedules";
import { getDocumentsByClass } from "@/utils/queries/documents/get-documents-by-class";
import { Document, Topic } from "@/types";
import { Schedule } from "@/types";
import { Event } from "@/types";

interface ProcessingStatus {
  stage: "extracting" | "classifying" | "analyzing" | "complete";
  progress: number;
  message: string;
  documentsProcessed: number;
  totalDocuments: number;
  syllabusFound: boolean;
  syllabusName?: string;
}

type ClassStatusProps = {
  classId: string;
};

export default function ClassStatus({ classId }: ClassStatusProps) {
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    stage: "extracting",
    progress: 0,
    message: "Extracting files from ZIP...",
    documentsProcessed: 0,
    totalDocuments: 0,
    syllabusFound: false,
  });

  // Fetch class data
  const { data: classData, isLoading: classLoading } = useQuery({
    queryKey: ["class", classId],
    queryFn: () => getClass(classId),
  });

  const { data: topics = [] } = useQuery({
    queryKey: ["topics", classId],
    queryFn: () => getTopicsByClass([classId]),
  });

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ["schedules", classId],
    queryFn: () => getSchedulesByClass([classId]),
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["events", classId],
    queryFn: () =>
      getEventsBySchedules(schedules.map((schedule) => schedule.id)),
    enabled: !!schedules,
  });

  // Fetch documents with polling
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["documents", classId],
    queryFn: () => getDocumentsByClass([classId]),
  });

  // Simulate processing stages based on document count and types
  useEffect(() => {
    if (documents.length === 0) return;

    const syllabusDoc = documents.find(
      (doc: Document) =>
        doc.type === "syllabus" || doc.name.toLowerCase().includes("syllabus"),
    );

    const classifiedDocs = documents.filter(
      (doc: Document) =>
        doc.type && doc.type.trim() !== "" && doc.type !== null,
    );

    const totalDocs = documents.length;
    const processedDocs = classifiedDocs.length;
    const progressPercent =
      totalDocs > 0 ? Math.round((processedDocs / totalDocs) * 100) : 0;

    let stage: ProcessingStatus["stage"] = "extracting";
    let message = "Extracting files from ZIP...";

    if (totalDocs > 0) {
      if (progressPercent < 50) {
        stage = "classifying";
        message = "Classifying documents with AI...";
      } else if (progressPercent < 100) {
        stage = "analyzing";
        message = "Analyzing document content and structure...";
      } else {
        stage = "complete";
        message = "Processing complete!";
      }
    }

    setProcessingStatus({
      stage,
      progress: progressPercent,
      message,
      documentsProcessed: processedDocs,
      totalDocuments: totalDocs,
      syllabusFound: !!syllabusDoc,
      syllabusName: syllabusDoc?.name || "",
    });
  }, [documents]);

  const getDocumentTypeInfo = (type: string) => {
    const typeMap: Record<
      string,
      { label: string; icon: string; color: string }
    > = {
      homework: {
        label: "Homework",
        icon: "📝",
        color: "bg-blue-100 text-blue-800",
      },
      project: {
        label: "Project",
        icon: "🚀",
        color: "bg-purple-100 text-purple-800",
      },
      quiz: {
        label: "Quiz",
        icon: "❓",
        color: "bg-yellow-100 text-yellow-800",
      },
      midterm: {
        label: "Midterm",
        icon: "📊",
        color: "bg-red-100 text-red-800",
      },
      lab: { label: "Lab", icon: "🧪", color: "bg-green-100 text-green-800" },
      lecture: {
        label: "Lecture",
        icon: "📚",
        color: "bg-indigo-100 text-indigo-800",
      },
      syllabus: {
        label: "Syllabus",
        icon: "📋",
        color: "bg-gray-100 text-gray-800",
      },
    };
    return (
      typeMap[type] || {
        label: type,
        icon: "📄",
        color: "bg-gray-100 text-gray-800",
      }
    );
  };

  const documentTypeCounts = documents.reduce(
    (acc: Record<string, number>, doc: Document) => {
      const type = doc.type || "unknown";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    {},
  );

  if (classLoading || schedulesLoading || eventsLoading || documentsLoading) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Class Not Found</h1>
          <p className="text-muted-foreground mt-2">
            The requested class could not be found.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Processing Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {processingStatus.stage === "complete" ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
              )}
              {processingStatus.message}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{processingStatus.progress}%</span>
              </div>
              <Progress value={processingStatus.progress} className="h-2" />
            </div>

            {processingStatus.totalDocuments > 0 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Documents processed: {processingStatus.documentsProcessed} /{" "}
                  {processingStatus.totalDocuments}
                </span>
                {processingStatus.syllabusFound && (
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <BookOpen className="h-3 w-3" />
                    Syllabus detected
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Class Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Class Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{classData.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Code</p>
                <p className="font-medium">{classData.classCode}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Term</p>
                <p className="font-medium capitalize">
                  {classData.term} {classData.year}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge
                  variant={
                    processingStatus.stage === "complete"
                      ? "default"
                      : "secondary"
                  }
                >
                  {processingStatus.stage === "complete"
                    ? "Ready"
                    : "Processing"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document Types Overview */}
        {documents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Document Classification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Object.entries(documentTypeCounts).map(([type, count]) => {
                  const typeInfo = getDocumentTypeInfo(type);
                  return (
                    <div
                      key={type}
                      className="text-center p-3 border rounded-lg"
                    >
                      <div className="text-2xl mb-1">{typeInfo.icon}</div>
                      <div className="text-sm font-medium">
                        {typeInfo.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {count} files
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Topics Found */}
        {topics.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Topics Identified
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {topics.slice(0, 12).map((topic: Topic) => (
                  <Badge key={topic.id} variant="outline">
                    {topic.name}
                  </Badge>
                ))}
                {topics.length > 12 && (
                  <Badge variant="secondary">+{topics.length - 12} more</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Schedules & Events */}
        {(schedules.length > 0 || events.length > 0) && (
          <div className="grid md:grid-cols-2 gap-4">
            {schedules.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Schedules
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {schedules.slice(0, 3).map((schedule: Schedule) => (
                      <div
                        key={schedule.id}
                        className="flex justify-between items-center p-2 border rounded"
                      >
                        <span className="text-sm font-medium">
                          {schedule.name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {schedule.description}
                        </Badge>
                      </div>
                    ))}
                    {schedules.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{schedules.length - 3} more schedules
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {events.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Upcoming Events
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {events.slice(0, 3).map((event: Event) => (
                      <div
                        key={event.id}
                        className="flex justify-between items-center p-2 border rounded"
                      >
                        <span className="text-sm font-medium">
                          {event.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                    {events.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{events.length - 3} more events
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
