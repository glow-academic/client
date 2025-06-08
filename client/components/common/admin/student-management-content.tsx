/**
 * components/admin/student-management-content.tsx
 * Student Management component
 */
"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Download, Loader2, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

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

export function StudentManagementContent() {
  const queryClient = useQueryClient();
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
} 