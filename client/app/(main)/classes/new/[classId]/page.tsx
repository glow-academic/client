"use client";
import React, { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle,
  Clock,
  FileText,
  Zap,
  GraduationCap,
  Settings,
  RefreshCw,
  AlertCircle,
  Archive,
  Search,
  BookOpen,
  Users,
  Calendar
} from "lucide-react";

import { getClass } from "@/utils/queries/get-class";
import { getDocuments } from "@/utils/queries/get-documents";
import { documents as DocumentItem } from "@/drizzle/schema";

type DocumentType = typeof DocumentItem.$inferSelect;

interface ProcessingStatus {
  stage: 'extracting' | 'classifying' | 'analyzing' | 'complete';
  progress: number;
  message: string;
  documentsProcessed: number;
  totalDocuments: number;
  syllabusFound: boolean;
  syllabusName?: string;
}

export default function ClassStatusPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    stage: 'extracting',
    progress: 0,
    message: 'Extracting files from ZIP...',
    documentsProcessed: 0,
    totalDocuments: 0,
    syllabusFound: false,
  });

  const [isPolling, setIsPolling] = useState(true);
  const [showClassForm, setShowClassForm] = useState(false);

  // Fetch class data
  const { data: classData, isLoading: classLoading } = useQuery({
    queryKey: ["class", classId],
    queryFn: () => getClass(classId),
    enabled: !!classId,
  });

  // Fetch documents with polling
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["documents", classId],
    queryFn: async () => {
      if (!classId) return [];
      const docs = await getDocuments();
      return docs.filter((doc: DocumentType) => doc.classId === classId);
    },
    enabled: !!classId,
    refetchInterval: isPolling ? 2000 : false, // Poll every 2 seconds while processing
  });

  // Simulate processing stages based on document count and types
  useEffect(() => {
    if (documents.length === 0) return;

    const syllabusDoc = documents.find((doc: DocumentType) => 
      doc.type === 'syllabus' || 
      doc.name.toLowerCase().includes('syllabus')
    );

    const classifiedDocs = documents.filter((doc: DocumentType) => 
      doc.type && doc.type.trim() !== '' && doc.type !== null
    );

    const totalDocs = documents.length;
    const processedDocs = classifiedDocs.length;
    const progressPercent = totalDocs > 0 ? Math.round((processedDocs / totalDocs) * 100) : 0;

    let stage: ProcessingStatus['stage'] = 'extracting';
    let message = 'Extracting files from ZIP...';

    if (totalDocs > 0) {
      if (progressPercent < 50) {
        stage = 'classifying';
        message = 'Classifying documents with AI...';
      } else if (progressPercent < 100) {
        stage = 'analyzing';
        message = 'Analyzing document content and structure...';
      } else {
        stage = 'complete';
        message = 'Processing complete!';
        setIsPolling(false);
      }
    }

    setProcessingStatus({
      stage,
      progress: progressPercent,
      message,
      documentsProcessed: processedDocs,
      totalDocuments: totalDocs,
      syllabusFound: !!syllabusDoc,
      syllabusName: syllabusDoc?.name,
    });
  }, [documents]);

  const getDocumentTypeInfo = (type: string) => {
    const typeMap: Record<string, { label: string; icon: string; color: string }> = {
      homework: { label: "Homework", icon: "📝", color: "bg-blue-100 text-blue-800" },
      project: { label: "Project", icon: "🚀", color: "bg-purple-100 text-purple-800" },
      quiz: { label: "Quiz", icon: "❓", color: "bg-yellow-100 text-yellow-800" },
      midterm: { label: "Midterm", icon: "📊", color: "bg-red-100 text-red-800" },
      lab: { label: "Lab", icon: "🧪", color: "bg-green-100 text-green-800" },
      lecture: { label: "Lecture", icon: "📚", color: "bg-indigo-100 text-indigo-800" },
      syllabus: { label: "Syllabus", icon: "📋", color: "bg-gray-100 text-gray-800" },
    };
    return typeMap[type] || { label: type, icon: "📄", color: "bg-gray-100 text-gray-800" };
  };

  const documentTypeCounts = documents.reduce((acc: Record<string, number>, doc: DocumentType) => {
    const type = doc.type || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const handleContinueToClass = () => {
    router.push(`/classes/c/${classId}/edit`);
  };

  const handleEditClassDetails = () => {
    setShowClassForm(true);
  };

  if (classLoading) {
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
          <Button onClick={() => router.push('/classes/new')} className="mt-4">
            Back to Create Class
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Archive className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Processing Your Class</h1>
          </div>
          <p className="text-muted-foreground">
            We're extracting and organizing your documents. This may take a few minutes.
          </p>
        </div>

        {/* Processing Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {processingStatus.stage === 'complete' ? (
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
                <span>Documents processed: {processingStatus.documentsProcessed} / {processingStatus.totalDocuments}</span>
                {processingStatus.syllabusFound && (
                  <Badge variant="secondary" className="flex items-center gap-1">
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
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Class Name</p>
                <p className="font-medium">{classData.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Class Code</p>
                <p className="font-medium">{classData.classCode}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Term</p>
                <p className="font-medium capitalize">{classData.term} {classData.year}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Documents</p>
                <p className="font-medium">{documents.length} files</p>
              </div>
            </div>
            
            {classData.name.includes('Temp Class') && (
              <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Temporary class created for processing</span>
                </div>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  You can update the class details once processing is complete.
                </p>
              </div>
            )}
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
                    <div key={type} className="text-center p-3 border rounded-lg">
                      <div className="text-2xl mb-1">{typeInfo.icon}</div>
                      <div className="text-sm font-medium">{typeInfo.label}</div>
                      <div className="text-xs text-muted-foreground">{count} files</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Syllabus Detection */}
        {processingStatus.syllabusFound && processingStatus.syllabusName && (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-green-900 dark:text-green-100">
                    Syllabus Detected!
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Found: {processingStatus.syllabusName}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    We'll use this to better understand your class structure and requirements.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {processingStatus.stage === 'complete' ? (
            <>
              <Button onClick={handleContinueToClass} size="lg">
                <Settings className="h-4 w-4 mr-2" />
                Continue to Class Settings
              </Button>
              {classData.name.includes('Temp Class') && (
                <Button variant="outline" onClick={handleEditClassDetails} size="lg">
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Update Class Details
                </Button>
              )}
            </>
          ) : (
            <Button variant="outline" disabled size="lg">
              <Clock className="h-4 w-4 mr-2" />
              Processing in progress...
            </Button>
          )}
        </div>

        {/* Processing Tips */}
        <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
              What's happening behind the scenes?
            </h3>
            <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4" />
                <span>Extracting all files from your ZIP archive</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span>Using AI to classify document types (homework, lectures, etc.)</span>
              </div>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <span>Analyzing content to identify key course materials</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                <span>Looking for syllabus and course structure information</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
