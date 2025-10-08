/**
 * app/(main)/layout.tsx
 * Layout for the main section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { log } from "@/utils/logger";
import { Plus, SlidersHorizontal, Upload } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { AnalyticsFilters } from "@/components/common/analytics/AnalyticsFilters";
import { DepartmentsFilters } from "@/components/common/analytics/DepartmentsFilters";
import UploadClassificationDialog from "@/components/common/documents/UploadClassificationDialog";
import ChatDialog from "@/components/common/home/ChatDialog";
import ChatFab from "@/components/common/home/ChatFab";
import ChatWidget from "@/components/common/home/ChatWidget";
import { AccessControl } from "@/components/common/layout/AccessControl";
import { NavigationBreadcrumbs } from "@/components/common/layout/NavigationBreadcrumbs";
import { UnifiedSidebar } from "@/components/common/layout/UnifiedSidebar";
import TATour from "@/components/home/TATour";
import { PracticeCustomizeDialog } from "@/components/practice/PracticeCustomizeDialog";
import { AnalyticsProvider } from "@/contexts/analytics-context";
import { AssistantProvider } from "@/contexts/assistant-context";
import {
  DepartmentsProvider,
  useDepartments,
} from "@/contexts/departments-context";
import { useProfile } from "@/contexts/profile-context";
import {
  SimulationProvider,
  useSimulation,
} from "@/contexts/simulation-context";
import { TourProvider } from "@/contexts/tour-context";
import { useWebSocket } from "@/contexts/websocket-context";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { useUpdateDocument } from "@/lib/api/hooks/documents";
import { useSimulationMessagesByChatId } from "@/lib/api/hooks/simulation_messages";
import { finalizeDocumentUpload } from "@/utils/api/documents/finalize-document-upload";
import { createPracticeScenario } from "@/utils/api/scenarios/create-practice-scenario";
import { getActiveSectionFromPath } from "@/utils/breadcrumb-utils";
import { inferMimeFromName } from "@/utils/mime-map";
import {
  createSectionChangeHandler,
  isMainScreen,
} from "@/utils/navigation-utils";
import * as tus from "tus-js-client";

// Inner component that uses the role context
function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { fileName: string };
      setPendingFiles((prev) => prev.filter((f) => f.name !== detail.fileName));
    };
    window.addEventListener("upload:remove-file", handler);
    return () => window.removeEventListener("upload:remove-file", handler);
  }, []);
  const router = useRouter();
  const { isConnected, emitStartSimulation } = useWebSocket();
  const { effectiveProfile, isLoading, activeProfile } = useProfile();
  const { effectiveDepartmentIds } = useDepartments();

  // Role context is available for child components
  const activeSection = getActiveSectionFromPath(pathname);
  const { breadcrumbs } = useBreadcrumbs(pathname);
  const simulationContext = useSimulation();
  const currentChatId = simulationContext?.currentChat?.id;
  const { data: currentChatMessages = [] } = useSimulationMessagesByChatId(
    currentChatId!
  );

  // Check if current user is the owner of this attempt (activeProfile, effectiveProfile, and attempt.profileId must all match)
  const isAttemptOwner = useMemo(() => {
    const attemptProfileId = simulationContext?.attempt?.profileId;
    if (!activeProfile?.id || !effectiveProfile?.id || !attemptProfileId) {
      return false;
    }
    return (
      (activeProfile.id === effectiveProfile.id &&
        activeProfile.id === attemptProfileId) ||
      activeProfile.role === "guest"
    );
  }, [
    activeProfile?.id,
    effectiveProfile?.id,
    simulationContext?.attempt?.profileId,
    activeProfile?.role,
  ]);

  // Upload state - track multiple uploads
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
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

  // Confirmation dialogs state
  const [confirmEndAllOpen, setConfirmEndAllOpen] = useState(false);
  const [endAllRemainingSessions, setEndAllRemainingSessions] = useState(0);
  const [confirmEndChatOpen, setConfirmEndChatOpen] = useState(false);

  // Track which action is ending, so only that button shows "Ending..."
  const [endingAction, setEndingAction] = useState<"endAll" | "endChat" | null>(
    null
  );
  React.useEffect(() => {
    if (!simulationContext?.endChatLoading) {
      setEndingAction(null);
    }
  }, [simulationContext?.endChatLoading]);

  // Practice customize dialog state
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [isStartingAttempt, setIsStartingAttempt] = useState(false);

  const { mutate: updateDocument } = useUpdateDocument();

  // Upload functions
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setPendingFiles(Array.from(files));
      setShowUploadDialog(true);
    }
  };

  const uploadFile = async (
    file: File,
    classification?: { type: import("@/types").DocumentType; tags: string[] },
    zipDefaults?: { type: import("@/types").DocumentType; tags: string[] }
  ) => {
    // Create a unique file ID for this upload
    const fileId = uuidv4();

    // Show progress toast for this specific file
    const toastId = toast.loading(`Preparing upload: ${file.name}`, {
      description: "0% complete",
      dismissible: true,
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
      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";
      const upload = new tus.Upload(file, {
        endpoint: `${appPrefix}/api/upload`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: {
          filename: file.name,
          // if browser didn't set a type, use our inference
          filetype: file.type || inferMimeFromName(file.name),
          fileId: fileId,
        },
        onError: (error) => {
          log.error("upload.tus.failed", {
            message: "Upload failed",
            error,
            context: { component: "MainLayoutContent", function: "uploadFile" },
          });
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
            dismissible: true,
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
              shouldAutoClassify, // autoClassify parameter
              effectiveProfile?.id
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

              // Apply client-side classification (type/tags)
              try {
                if (!isZipFile && result.document_id && classification) {
                  await updateDocument({
                    id: result.document_id,
                    type: classification.type,
                    tags: classification.tags,
                    classified: true,
                    updatedAt: new Date().toISOString(),
                  });
                }
                if (
                  isZipFile &&
                  Array.isArray(result.documents) &&
                  zipDefaults
                ) {
                  for (const d of result.documents) {
                    await updateDocument({
                      id: d.id,
                      type: zipDefaults.type,
                      tags: zipDefaults.tags,
                      classified: true,
                      updatedAt: new Date().toISOString(),
                    });
                  }
                }
              } catch (classificationError) {
                log.error("upload.classification.update.failed", {
                  message: "Post-upload classification update failed",
                  error: classificationError,
                  context: { component: "MainLayoutContent" },
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
            log.error("upload.finalize.failed", {
              message: "Finalization failed",
              error: finalizeError,
              context: { component: "MainLayoutContent" },
            });
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
      log.error("upload.error", {
        message: "Upload error",
        error,
        context: { component: "MainLayoutContent" },
      });
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

  const isHomePage = useMemo(() => {
    return pathname === "/home";
  }, [pathname]);

  const isReportPage = useMemo(() => {
    return pathname.startsWith("/analytics/reports/p");
  }, [pathname]);

  const isSystemPage = useMemo(() => {
    return pathname.startsWith("/system");
  }, [pathname]);

  const isChatPage = useMemo(() => {
    return pathname.startsWith("/practice/a") || pathname.startsWith("/home/a");
  }, [pathname]);

  const canShowAnalyticsFilters = useMemo(() => {
    const allowedRoles = ["instructional", "admin", "superadmin"];
    return (
      effectiveProfile?.role &&
      allowedRoles.includes(effectiveProfile.role) &&
      (isAnalyticsPage || isHomePage) &&
      !pathname.includes("/edit") &&
      !isLoading
    );
  }, [
    effectiveProfile?.role,
    isAnalyticsPage,
    pathname,
    isLoading,
    isHomePage,
  ]);

  const canShowDepartmentsFilters = useMemo(() => {
    return (
      effectiveProfile?.role === "superadmin" && !isSystemPage && !isChatPage
    );
  }, [effectiveProfile?.role, isSystemPage, isChatPage]);

  const handleSectionChange = createSectionChangeHandler(router, pathname);

  // Determine action button based on current path
  const getActionButton = () => {
    if (simulationContext) {
      const {
        endChat,
        endChatLoading,
        isSingleChatAttempt,
        isLastAttempt,
        simulation,
        isActive,
        showResults,
        chats,
        expectedChatCount,
      } = simulationContext;

      let buttonLabel = "End Chat";
      if (isSingleChatAttempt) {
        buttonLabel = "End Session";
      } else if (isLastAttempt) {
        buttonLabel = "End Session";
      } else {
        buttonLabel = "End & Next Chat";
      }

      // Check if there are at least 2 remaining sessions for End All button
      // Count incomplete chats + scenarios that haven't been created as chats yet
      const incompleteChats = chats.filter((chat) => !chat.completed).length;
      const createdChats = chats.length;
      const remainingScenarios = expectedChatCount - createdChats;
      const remainingSessions = incompleteChats + remainingScenarios;
      const showEndAllButton = remainingSessions >= 2;

      return (
        !showResults &&
        isAttemptOwner && (
          <div className="flex gap-2">
            {showEndAllButton && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setEndAllRemainingSessions(remainingSessions);
                  setConfirmEndAllOpen(true);
                }}
                disabled={endChatLoading}
                className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm"
                data-tour-end-all
              >
                {endChatLoading && endingAction === "endAll"
                  ? "Ending..."
                  : `End All (${remainingSessions})`}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const totalMessages = currentChatMessages.length;
                if (totalMessages < 2) {
                  setConfirmEndChatOpen(true);
                  return;
                }
                // Dispatch endChatButtonPressed event for tour progression and navigating state management
                window.dispatchEvent(
                  new CustomEvent("endChatButtonPressed", {
                    detail: {
                      chatId: simulationContext.currentChat?.id,
                      attemptId: simulationContext.attemptId,
                    },
                  })
                );
                setEndingAction("endChat");
                endChat();
              }}
              disabled={
                endChatLoading || (simulation?.timeLimit ? !isActive : false)
              }
              className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm relative overflow-hidden"
              data-tour-end-chat
            >
              {/* Grading progress overlay - fills from left to right */}
              {simulationContext?.isGrading &&
                simulationContext?.gradingProgress && (
                  <span
                    className="absolute inset-0 bg-blue-500/20 transition-all duration-300 ease-out"
                    style={{
                      width: `${
                        (simulationContext.gradingProgress.completed /
                          simulationContext.gradingProgress.total) *
                        100
                      }%`,
                    }}
                  />
                )}

              {/* Button text */}
              <span className="relative z-10">
                {endChatLoading && endingAction === "endChat"
                  ? "Ending..."
                  : buttonLabel}
              </span>
            </Button>
          </div>
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
            accept={[
              "application/pdf",
              "image/*",
              "application/msword",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              "text/plain",
              "application/zip",
              "text/html",
              // Extensions for source files & common texty formats
              ".java,.py,.c,.h,.cpp,.hpp,.cc,.cs,.js,.jsx,.ts,.tsx,.mjs,.cjs,.html,.css,.scss,.md,.json,.yml,.yaml,.xml,.sh,.bash,.zsh,.rb,.go,.rs,.kt,.swift,.m,.mm,.sql,.ipynb",
            ].join(",")}
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
        <Button
          onClick={() =>
            window.dispatchEvent(new CustomEvent("openCreateStaff"))
          }
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Staff
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

    if (pathname === "/management/parameters") {
      return (
        <Button
          onClick={() => router.push("/management/parameters/new")}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Parameter
        </Button>
      );
    }

    if (pathname === "/system/agents") {
      return (
        <Button onClick={() => router.push("/system/agents/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Agent
        </Button>
      );
    }

    if (pathname === "/system/departments") {
      return (
        <Button
          onClick={() => router.push("/system/departments/new")}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Department
        </Button>
      );
    }

    // Practice page: role-based visibility
    // - instructional/admin/superadmin: always show
    // - ta: show only if tour completed (viewedIntro && viewedChat)
    // - guest: never show
    if (pathname === "/practice") {
      const role = effectiveProfile?.role;
      if (role === "guest") {
        return null;
      }
      if (role === "ta") {
        if (!(effectiveProfile?.viewedIntro && effectiveProfile?.viewedChat)) {
          return null;
        }
      }
      const privilegedRoles: Array<import("@/types").ProfileRole> = [
        "instructional",
        "admin",
        "superadmin",
        "ta",
      ];
      if (!role || !privilegedRoles.includes(role)) {
        return null;
      }
      return (
        <Button onClick={() => setCustomizeOpen(true)} size="sm">
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Customize
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

            {/* Department Filters - Show for superadmin users */}
            {canShowDepartmentsFilters && <DepartmentsFilters />}

            {/* Analytics Filters - Show in top right for analytics pages */}
            {canShowAnalyticsFilters && (
              <AnalyticsFilters
                homePage={isHomePage}
                reportPage={isReportPage}
              />
            )}

            {actionButton && <div className="pr-4">{actionButton}</div>}
          </header>
          {/* Practice Customize Dialog */}
          {customizeOpen && (
            <PracticeCustomizeDialog
              open={customizeOpen}
              onClose={() => setCustomizeOpen(false)}
              onStartAttempt={async (params) => {
                if (params.timeLimit) {
                  // Infinite mode - use WebSocket
                  if (!isConnected) {
                    toast.error(
                      "WebSocket not connected. Please refresh the page."
                    );
                    return;
                  }
                  if (
                    effectiveDepartmentIds.length === 0 ||
                    !effectiveDepartmentIds[0]
                  ) {
                    toast.error("No department found. Please contact support.");
                    return;
                  }
                  const profileIdForEmit =
                    effectiveProfile?.role === "guest"
                      ? ""
                      : String(effectiveProfile?.id || "");
                  toast.loading("Starting simulation...", {
                    dismissible: true,
                  });
                  emitStartSimulation({
                    simulation_id: params.simulationId,
                    profile_id: profileIdForEmit,
                    infinite: true,
                    infinite_time_limit: params.timeLimit,
                    department_id: effectiveDepartmentIds[0],
                  });
                  setCustomizeOpen(false);
                } else {
                  // Custom one-off scenario
                  setIsStartingAttempt(true);
                  const startToastId = toast.loading(
                    "Creating practice scenario...",
                    {
                      dismissible: true,
                    }
                  ) as unknown as string;

                  try {
                    const result = await createPracticeScenario({
                      personaId: params.personaId!,
                      parameterItemIds: params.parameterItemIds || [],
                      profileId: effectiveProfile?.id || "",
                    });

                    if (result.success && result.scenario) {
                      toast.success("Practice scenario created!", {
                        id: startToastId,
                        dismissible: true,
                      });
                      // Navigate to practice page to start the scenario
                      router.push("/practice");
                    } else {
                      throw new Error(
                        result.message || "Failed to create practice scenario"
                      );
                    }
                  } catch (error) {
                    log.error("practice.session.error", {
                      message: "Error starting practice session",
                      error,
                      context: { function: "onStartAttempt" },
                    });
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Failed to start practice session",
                      {
                        id: "start-attempt",
                        dismissible: true,
                      }
                    );
                  } finally {
                    setIsStartingAttempt(false);
                    setCustomizeOpen(false);
                  }
                }
              }}
              isStartingAttempt={isStartingAttempt}
              effectiveProfile={effectiveProfile!}
              activeProfile={activeProfile!}
            />
          )}

          {/* Confirm End All Dialog */}
          <AlertDialog
            open={confirmEndAllOpen}
            onOpenChange={setConfirmEndAllOpen}
          >
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>End all remaining sessions?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will mark {endAllRemainingSessions} remaining session
                  {endAllRemainingSessions === 1 ? "" : "s"} as incomplete, and
                  their scores will not count.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    // Dispatch endAllChatsButtonPressed event for tour progression
                    window.dispatchEvent(
                      new CustomEvent("endAllChatsButtonPressed", {
                        detail: {
                          attemptId: simulationContext?.attemptId,
                          remainingSessions: endAllRemainingSessions,
                        },
                      })
                    );
                    setConfirmEndAllOpen(false);
                    setEndingAction("endAll");
                    simulationContext?.endAllChats();
                  }}
                >
                  End All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Confirm End Chat (no messages) Dialog */}
          <AlertDialog
            open={confirmEndChatOpen}
            onOpenChange={setConfirmEndChatOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End chat now?</AlertDialogTitle>
                <AlertDialogDescription>
                  You have not sent any messages in this chat. Ending now will
                  mark this chat as incomplete and the score will not count.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Continue Chat</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    // Dispatch endChatButtonPressed event for tour progression and navigating state management
                    window.dispatchEvent(
                      new CustomEvent("endChatButtonPressed", {
                        detail: {
                          chatId: simulationContext?.currentChat?.id,
                          attemptId: simulationContext?.attemptId,
                        },
                      })
                    );
                    setConfirmEndChatOpen(false);
                    setEndingAction("endChat");
                    simulationContext?.endChat();
                  }}
                >
                  End Chat
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {/* Upload classification dialog */}
          {showUploadDialog && (
            <UploadClassificationDialog
              open={showUploadDialog}
              files={pendingFiles}
              onClose={() => {
                setShowUploadDialog(false);
                // Clear dialog local state and allow reselection of same files later
                setPendingFiles([]);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              onConfirm={async (perFile, zipDefaults) => {
                setShowUploadDialog(false);
                // Kick off uploads with provided classifications
                for (const file of pendingFiles) {
                  const classification = perFile[file.name];
                  // Fire without awaiting to allow parallel uploads
                  (async () => {
                    await uploadFile(file, classification, zipDefaults);
                  })();
                }
                // Clear state so user can add the same docs again if needed
                setPendingFiles([]);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              onAddFiles={(files) => {
                setPendingFiles((prev) => [...prev, ...files]);
              }}
              onRemoveFile={(fileName) =>
                setPendingFiles((prev) =>
                  prev.filter((f) => f.name !== fileName)
                )
              }
            />
          )}
          <div
            className={`flex flex-1 flex-col gap-4 p-4 pt-0 ${
              shouldShowChatComponents && canShowChatComponents ? "pb-18" : ""
            }`}
          >
            <AccessControl pathname={pathname}>{children}</AccessControl>
          </div>
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

      {/* Tour Component - Available globally for TA users; hide when acting on behalf of another */}
      {effectiveProfile?.role === "ta" &&
        activeProfile?.id === effectiveProfile?.id && <TATour />}
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
        <DepartmentsProvider>
          {attemptId ? (
            <SimulationProvider attemptId={attemptId}>
              <MainLayoutContent>{children}</MainLayoutContent>
            </SimulationProvider>
          ) : (
            <MainLayoutContent>{children}</MainLayoutContent>
          )}
        </DepartmentsProvider>
      </AnalyticsProvider>
    </TourProvider>
  );
}
