/**
 * app/(main)/layout.tsx
 * Layout for the main section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { logError } from "@/utils/logger";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Upload } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload as TusUpload } from "tus-js-client";
import { v4 as uuidv4 } from "uuid";

import { AnalyticsFilters } from "@/components/common/analytics/AnalyticsFilters";
import ChatDialog from "@/components/common/home/ChatDialog";
import ChatFab from "@/components/common/home/ChatFab";
import ChatWidget from "@/components/common/home/ChatWidget";
import { NavigationBreadcrumbs } from "@/components/common/layout/NavigationBreadcrumbs";
import { UnifiedSidebar } from "@/components/common/layout/UnifiedSidebar";
import TATour from "@/components/home/TATour";
import { AnalyticsProvider } from "@/contexts/analytics-context";
import { AssistantProvider } from "@/contexts/assistant-context";
import { useProfile } from "@/contexts/profile-context";
import {
  SimulationProvider,
  useSimulation,
} from "@/contexts/simulation-context";
import { TourProvider } from "@/contexts/tour-context";
import { finalizeDocumentUpload } from "@/utils/api/documents/finalize-document-upload";
import {
  generateEnhancedBreadcrumbs,
  getActiveSectionFromPath,
} from "@/utils/breadcrumb-utils";
import {
  createSectionChangeHandler,
  isMainScreen,
} from "@/utils/navigation-utils";

// Inner component that uses the role context
function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { effectiveProfile } = useProfile();
  const queryClient = useQueryClient();

  // Role context is available for child components
  const activeSection = getActiveSectionFromPath(pathname);
  const [breadcrumbs, setBreadcrumbs] = React.useState<
    Array<{ title: string; section?: string }>
  >([]);
  const simulationContext = useSimulation();

  // Upload state - track multiple uploads
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploads, setActiveUploads] = useState<
    Map<
      string,
      {
        file: File;
        progress: number;
        toastId: string;
        status: "uploading" | "finalizing" | "completed" | "error";
      }
    >
  >(new Map());

  // Upload functions
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // Process all selected files in parallel
      Array.from(files).forEach((file) => {
        uploadFile(file);
      });
    }
  };

  const uploadFile = async (file: File) => {
    // Create a unique file ID for this upload
    const fileId = uuidv4();

    // Show progress toast for this specific file
    const toastId = toast.loading(`Preparing upload: ${file.name}`, {
      description: "0% complete",
    });

    // Add to active uploads
    setActiveUploads((prev) =>
      new Map(prev).set(fileId, {
        file,
        progress: 0,
        toastId: toastId as string,
        status: "uploading",
      })
    );

    try {
      // Create TUS upload
      const upload = new TusUpload(file, {
        endpoint: "/api/upload",
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: {
          filename: file.name,
          filetype: file.type,
          fileId: fileId,
        },
        onError: (error) => {
          logError("Upload failed:", error);
          toast.error(`Upload failed: ${file.name}`, {
            description: error.message || "An error occurred during upload",
            id: toastId,
          });

          // Remove from active uploads
          setActiveUploads((prev) => {
            const newMap = new Map(prev);
            newMap.delete(fileId);
            return newMap;
          });
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const progress = Math.round((bytesUploaded / bytesTotal) * 100);

          // Update progress for this specific upload
          setActiveUploads((prev) => {
            const newMap = new Map(prev);
            const upload = newMap.get(fileId);
            if (upload) {
              newMap.set(fileId, {
                ...upload,
                progress,
              });
            }
            return newMap;
          });

          toast.loading(`Uploading ${file.name}... ${progress}%`, {
            description: `${Math.round((bytesUploaded / 1024 / 1024) * 100) / 100} MB / ${Math.round((bytesTotal / 1024 / 1024) * 100) / 100} MB`,
            id: toastId,
          });
        },
        onSuccess: async () => {
          // Update status to finalizing
          setActiveUploads((prev) => {
            const newMap = new Map(prev);
            const upload = newMap.get(fileId);
            if (upload) {
              newMap.set(fileId, {
                ...upload,
                status: "finalizing",
              });
            }
            return newMap;
          });

          // Finalize the upload after TUS upload completes
          try {
            // Check if this is a ZIP file
            const isZipFile = file.name.toLowerCase().endsWith(".zip");

            // Auto-classify ZIP files by default
            const shouldAutoClassify = isZipFile;

            const result = await finalizeDocumentUpload(
              fileId,
              isZipFile, // zip parameter
              shouldAutoClassify // autoClassify parameter
            );

            if (result.success) {
              const isZipFile = file.name.toLowerCase().endsWith(".zip");
              const description = isZipFile
                ? `Extracted ${result.extracted_count || 0} documents${result.classification_result?.success ? " and auto-classified" : ""}`
                : "File uploaded and processed successfully";

              toast.success(`Upload completed: ${file.name}!`, {
                description,
                id: toastId,
              });

              // Update status to completed
              setActiveUploads((prev) => {
                const newMap = new Map(prev);
                const upload = newMap.get(fileId);
                if (upload) {
                  newMap.set(fileId, {
                    ...upload,
                    status: "completed",
                  });
                }
                return newMap;
              });

              // Invalidate documents queries to refresh the UI
              await queryClient.invalidateQueries({ queryKey: ["documents"] });

              // If we're on the documents page, also invalidate any filtered queries
              if (pathname === "/create/documents") {
                await queryClient.invalidateQueries({
                  queryKey: ["documents"],
                  exact: false,
                });
              }

              // Remove from active uploads after a delay to show completion
              setTimeout(() => {
                setActiveUploads((prev) => {
                  const newMap = new Map(prev);
                  newMap.delete(fileId);
                  return newMap;
                });
              }, 2000);
            } else {
              toast.error(`Upload processing failed: ${file.name}`, {
                description:
                  result.message || "Failed to process uploaded file",
                id: toastId,
              });

              // Remove from active uploads
              setActiveUploads((prev) => {
                const newMap = new Map(prev);
                newMap.delete(fileId);
                return newMap;
              });
            }
          } catch (finalizeError) {
            logError("Finalization failed:", finalizeError);
            toast.error(`Upload processing failed: ${file.name}`, {
              description: "Failed to process uploaded file",
              id: toastId,
            });

            // Remove from active uploads
            setActiveUploads((prev) => {
              const newMap = new Map(prev);
              newMap.delete(fileId);
              return newMap;
            });
          }

          // Clear the file input
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        },
      });

      // Start the upload
      await upload.start();
    } catch (error) {
      logError("Upload error:", error);
      toast.error(`Upload failed: ${file.name}`, {
        description:
          error instanceof Error
            ? error.message
            : "An error occurred during upload",
        id: toastId,
      });

      // Remove from active uploads
      setActiveUploads((prev) => {
        const newMap = new Map(prev);
        newMap.delete(fileId);
        return newMap;
      });
    }
  };

  const handleUploadClick = () => {
    if (activeUploads.size === 0) {
      fileInputRef.current?.click();
    }
  };

  // Check if we're on a main screen that should show chat components
  const shouldShowChatComponents = useMemo(() => {
    return isMainScreen(pathname);
  }, [pathname]);

  // Check if user has permission to see chat components (instructional, admin, superadmin only)
  const canShowChatComponents = useMemo(() => {
    const allowedRoles = ["instructional", "admin", "superadmin"];
    return (
      effectiveProfile?.role && allowedRoles.includes(effectiveProfile.role)
    );
  }, [effectiveProfile?.role]);

  // Check if we're on an analytics page and should show filters
  const isAnalyticsPage = useMemo(() => {
    return pathname.startsWith("/analytics");
  }, [pathname]);

  const canShowAnalyticsFilters = useMemo(() => {
    const allowedRoles = ["instructional", "admin", "superadmin"];
    return (
      effectiveProfile?.role &&
      allowedRoles.includes(effectiveProfile.role) &&
      isAnalyticsPage &&
      !pathname.includes("/edit")
    );
  }, [effectiveProfile?.role, isAnalyticsPage, pathname]);

  // Load enhanced breadcrumbs with async ID resolution
  React.useEffect(() => {
    const loadBreadcrumbs = async () => {
      const enhancedBreadcrumbs = await generateEnhancedBreadcrumbs(pathname);
      setBreadcrumbs(enhancedBreadcrumbs);
    };
    loadBreadcrumbs();
  }, [pathname]);

  const handleSectionChange = createSectionChangeHandler(router, pathname);

  // Determine action button based on current path
  const getActionButton = () => {
    // Don't show create buttons on the creation pages themselves
    if (
      pathname.includes("/t/") ||
      pathname.includes("/s/") ||
      pathname.includes("/p/") ||
      pathname.includes("/u/")
    ) {
      return null;
    }

    if (simulationContext) {
      const {
        endChat,
        endChatLoading,
        isSingleChatAttempt,
        isLastAttempt,
        simulation,
        isActive,
        showResults,
      } = simulationContext;

      let buttonLabel = "End Chat";
      if (isSingleChatAttempt) {
        buttonLabel = "End Session";
      } else if (isLastAttempt) {
        buttonLabel = "End Session";
      } else {
        buttonLabel = "End & Next Chat";
      }

      return (
        !showResults && (
          <Button
            type="button"
            variant="outline"
            onClick={endChat}
            disabled={
              endChatLoading || (simulation?.timeLimit ? !isActive : false)
            }
            className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm"
            data-tour-end-chat
          >
            {endChatLoading ? "Ending..." : buttonLabel}
          </Button>
        )
      );
    }

    if (pathname === "/cohorts") {
      return (
        <Button onClick={() => router.push("/cohorts/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Cohort
        </Button>
      );
    }

    if (pathname === "/create/personas") {
      return (
        <Button onClick={() => router.push("/create/personas/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Persona
        </Button>
      );
    }

    if (pathname === "/create/documents") {
      return (
        <>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            disabled={activeUploads.size > 0}
            accept="application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/zip"
            className="hidden"
          />
          <Button
            onClick={handleUploadClick}
            size="sm"
            disabled={activeUploads.size > 0}
          >
            <Upload className="h-4 w-4 mr-2" />
            {activeUploads.size > 0 ? "Uploading..." : "Upload Document(s)"}
          </Button>
        </>
      );
    }

    if (pathname === "/create/rubrics") {
      return (
        <Button onClick={() => router.push("/create/rubrics/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Rubric
        </Button>
      );
    }

    if (pathname === "/create/scenarios") {
      return (
        <Button onClick={() => router.push("/create/scenarios/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Scenario
        </Button>
      );
    }

    if (pathname === "/create/simulations") {
      return (
        <Button
          onClick={() => router.push("/create/simulations/new")}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Simulation
        </Button>
      );
    }

    if (pathname === "/management/staff") {
      return (
        <Button onClick={() => router.push("/management/staff/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Staff
        </Button>
      );
    }

    if (pathname === "/management/departments") {
      return (
        <Button
          onClick={() => router.push("/management/departments/new")}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Department
        </Button>
      );
    }

    if (pathname === "/management/providers") {
      return (
        <Button
          onClick={() => router.push("/management/providers/new")}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Provider
        </Button>
      );
    }

    if (!shouldShowChatComponents && canShowChatComponents) {
      return (
        <>
          <ChatFab up={true} />
          <ChatWidget up={true} />
          <ChatDialog />
        </>
      );
    }

    return null;
  };

  const actionButton = getActionButton();

  return (
    <AssistantProvider>
      <SidebarProvider>
        <UnifiedSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
        />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4 flex-1">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <NavigationBreadcrumbs
                breadcrumbs={breadcrumbs}
                onSectionChange={handleSectionChange}
              />
            </div>

            {/* Analytics Filters - Show in top right for analytics pages */}
            {canShowAnalyticsFilters && (
              <div className="px-4">
                <AnalyticsFilters />
              </div>
            )}

            {actionButton && <div className="px-4">{actionButton}</div>}
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
        </SidebarInset>
      </SidebarProvider>

      {/* Chat Components - Only show on main screens defined in the sidebar for allowed roles */}
      {shouldShowChatComponents && canShowChatComponents && (
        <>
          <ChatFab up={false} />
          <ChatWidget up={false} />
          <ChatDialog />
        </>
      )}

      {/* Tour Component - Available globally for TA users */}
      {effectiveProfile?.role === "ta" && <TATour />}
    </AssistantProvider>
  );
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const attemptId = useMemo(() => {
    const match = pathname?.match(/^\/(?:home|practice)\/a\/([^\/]+)/);
    return match ? match[1] : null;
  }, [pathname]);

  // If we have an attemptId, wrap the content in the provider.
  // Otherwise, render the content directly.
  return (
    <TourProvider>
      <AnalyticsProvider>
        {attemptId ? (
          <SimulationProvider attemptId={attemptId}>
            <MainLayoutContent>{children}</MainLayoutContent>
          </SimulationProvider>
        ) : (
          <MainLayoutContent>{children}</MainLayoutContent>
        )}
      </AnalyticsProvider>
    </TourProvider>
  );
}
