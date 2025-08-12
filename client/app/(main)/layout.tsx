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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { logError } from "@/utils/logger";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, SlidersHorizontal, Upload } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { AnalyticsFilters } from "@/components/common/analytics/AnalyticsFilters";
import UploadClassificationDialog from "@/components/common/documents/UploadClassificationDialog";
import ChatDialog from "@/components/common/home/ChatDialog";
import ChatFab from "@/components/common/home/ChatFab";
import ChatWidget from "@/components/common/home/ChatWidget";
import { AccessControl } from "@/components/common/layout/AccessControl";
import { NavigationBreadcrumbs } from "@/components/common/layout/NavigationBreadcrumbs";
import { UnifiedSidebar } from "@/components/common/layout/UnifiedSidebar";
import { ParameterSelector } from "@/components/common/scenario/ParameterSelector";
import { PersonaPicker } from "@/components/common/scenario/PersonaPicker";
import TATour from "@/components/home/TATour";
import { AnalyticsProvider } from "@/contexts/analytics-context";
import { AssistantProvider } from "@/contexts/assistant-context";
import { useProfile } from "@/contexts/profile-context";
import {
  SimulationProvider,
  useSimulation,
} from "@/contexts/simulation-context";
import { TourProvider } from "@/contexts/tour-context";
import type {
  Parameter,
  ParameterItem,
  Persona,
  Scenario,
  Simulation,
} from "@/types";
import { finalizeDocumentUpload } from "@/utils/api/documents/finalize-document-upload";
import {
  generateEnhancedBreadcrumbs,
  getActiveSectionFromPath,
} from "@/utils/breadcrumb-utils";
import { inferMimeFromName } from "@/utils/mime-map";
import { createScenario } from "@/utils/mutations/scenarios/create-scenario";
import { createSimulationAttempt } from "@/utils/mutations/simulation_attempts/create-simulation-attempt";
import { createSimulationChat } from "@/utils/mutations/simulation_chats/create-simulation-chat";
import {
  createSectionChangeHandler,
  isMainScreen,
} from "@/utils/navigation-utils";
import { getAllParameterItems } from "@/utils/queries/parameter_items/get-all-parameter-items";
import { getAllParameters } from "@/utils/queries/parameters/get-all-parameters";
import { getAllPersonas } from "@/utils/queries/personas/get-all-personas";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationMessagesByChat } from "@/utils/queries/simulation_messages/get-simulation-messages-by-chat";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
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
  const { effectiveProfile, isLoading, activeProfile } = useProfile();
  const queryClient = useQueryClient();

  // Role context is available for child components
  const activeSection = getActiveSectionFromPath(pathname);
  const [breadcrumbs, setBreadcrumbs] = React.useState<
    Array<{ title: string; section?: string }>
  >([]);
  const simulationContext = useSimulation();
  const currentChatId = simulationContext?.currentChat?.id;
  const { data: currentChatMessages = [] } = useQuery({
    queryKey: ["simulationMessages", currentChatId],
    queryFn: () => getSimulationMessagesByChat(currentChatId!),
    enabled: !!currentChatId,
  });

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
  const [isInfiniteMode, setIsInfiniteMode] = useState(false);
  const [infiniteTimeLimit, setInfiniteTimeLimit] = useState<string>("");
  const [selectedSimulationId, setSelectedSimulationId] = useState<string>("");
  const [selectedPersona, setSelectedPersona] = useState<Persona | undefined>(
    undefined
  );
  const [selectedParameterItemIds, setSelectedParameterItemIds] = useState<
    string[]
  >([]);

  // Data for customize dialog
  const { data: simulations = [] } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });
  const { data: scenarios = [] } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });
  const { data: personas = [] } = useQuery({
    queryKey: ["personas"],
    queryFn: () => getAllPersonas(),
  });
  const { data: parameters = [] } = useQuery({
    queryKey: ["parameters"],
    queryFn: () => getAllParameters(),
  });
  const { data: parameterItems = [] } = useQuery({
    queryKey: ["parameter-items"],
    queryFn: () => getAllParameterItems(),
  });

  // Only allow customizing non-default parameters and non-default items
  const customParameters = React.useMemo(() => {
    return (parameters as Parameter[]).filter(
      (p) => p.defaultParameter === false
    );
  }, [parameters]);
  const customParameterItems = React.useMemo(() => {
    // Use ONLY default items, but only for the non-default parameters
    const customParamIds = new Set(customParameters.map((p) => p.id));
    return (parameterItems as ParameterItem[]).filter(
      (pi) => pi.defaultItem === true && customParamIds.has(pi.parameterId)
    );
  }, [parameterItems, customParameters]);

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
      const upload = new tus.Upload(file, {
        endpoint: "/api/upload",
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: {
          filename: file.name,
          // if browser didn't set a type, use our inference
          filetype: file.type || inferMimeFromName(file.name),
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
                  const { updateDocument } = await import(
                    "@/utils/mutations/documents/update-document"
                  );
                  await updateDocument(result.document_id, {
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
                  const { updateDocument } = await import(
                    "@/utils/mutations/documents/update-document"
                  );
                  for (const d of result.documents) {
                    await updateDocument(d.id, {
                      type: zipDefaults.type,
                      tags: zipDefaults.tags,
                      classified: true,
                      updatedAt: new Date().toISOString(),
                    });
                  }
                }
              } catch (classificationError) {
                logError(
                  "Post-upload classification update failed:",
                  classificationError
                );
              }

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

  const isHomePage = useMemo(() => {
    return pathname === "/home";
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
        !showResults && (
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
              className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm"
              data-tour-end-chat
            >
              {endChatLoading && endingAction === "endChat"
                ? "Ending..."
                : buttonLabel}
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

    // Practice page: show Customize button in header right
    if (pathname === "/practice") {
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

            {/* Analytics Filters - Show in top right for analytics pages */}
            {canShowAnalyticsFilters && (
              <div className="px-4">
                <AnalyticsFilters />
              </div>
            )}

            {actionButton && <div className="px-4">{actionButton}</div>}
          </header>
          {/* Practice Customize Dialog */}
          <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Customize Practice</DialogTitle>
                <DialogDescription>
                  Create a custom attempt. Use Infinite Mode to keep practicing
                  a single practice simulation repeatedly, or configure a
                  one-off practice scenario.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <Label htmlFor="infinite-mode" className="mb-0">
                      Infinite Mode
                    </Label>
                    <Switch
                      id="infinite-mode"
                      checked={isInfiniteMode}
                      onCheckedChange={setIsInfiniteMode}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Practice one simulation continuously. Choose any simulation
                    marked for practice and repeat it until you stop.
                  </p>
                </div>

                {isInfiniteMode ? (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label>Start Simulation</Label>
                      <Select
                        value={selectedSimulationId}
                        onValueChange={setSelectedSimulationId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a simulation" />
                        </SelectTrigger>
                        <SelectContent>
                          {(simulations as Simulation[])
                            .filter((sim) => sim.practiceSimulation === true)
                            .map((sim: Simulation) => (
                              <SelectItem key={sim.id} value={sim.id}>
                                {sim.title}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="infinite-time-limit">
                        Time Limit (minutes, optional)
                      </Label>
                      <Input
                        id="infinite-time-limit"
                        type="number"
                        min={1}
                        placeholder="e.g. 15"
                        value={infiniteTimeLimit}
                        onChange={(e) => setInfiniteTimeLimit(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    <div className="grid gap-2">
                      <PersonaPicker
                        personas={personas as Persona[]}
                        onSelect={(p) => setSelectedPersona(p)}
                        selectedPersona={selectedPersona}
                        label="Persona"
                        description="Choose who you'll practice with."
                      />
                    </div>
                    <div className="grid gap-2">
                      <ParameterSelector
                        parameters={customParameters}
                        parameterItems={customParameterItems}
                        selectedParameterItemIds={selectedParameterItemIds}
                        onParameterItemIdsChange={setSelectedParameterItemIds}
                      />
                      {customParameterItems.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No default parameter items were found for these
                          parameters. Ensure the parameters have default options
                          configured under Management → Parameters.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCustomizeOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      if (isInfiniteMode) {
                        if (!selectedSimulationId) {
                          toast.error("Select a simulation to start");
                          return;
                        }
                        const sim = (simulations as Simulation[]).find(
                          (s) => s.id === selectedSimulationId
                        );
                        if (!sim) {
                          toast.error("Simulation not found");
                          return;
                        }
                        const attempt = (await createSimulationAttempt({
                          simulationId: sim.id,
                          profileId: effectiveProfile?.id,
                          infiniteMode: true,
                          infiniteModeTimeLimit: infiniteTimeLimit
                            ? parseInt(infiniteTimeLimit, 10)
                            : null,
                        } as unknown as typeof import("@/utils/drizzle/schema").simulationAttempts.$inferInsert)) as unknown as import("@/types").SimulationAttempt;

                        if (!attempt || !attempt.id) {
                          toast.error("Failed to create attempt");
                          return;
                        }
                        const attemptIdCreated = attempt.id;

                        const initialScenarioId = (sim.scenarioIds || [])[0];
                        if (initialScenarioId) {
                          await createSimulationChat({
                            title: sim.title,
                            scenarioId: initialScenarioId,
                            attemptId: attemptIdCreated,
                            completed: false,
                          } as unknown as typeof import("@/utils/drizzle/schema").simulationChats.$inferInsert);
                        }

                        setCustomizeOpen(false);
                        router.push(`/practice/a/${attemptIdCreated}`);
                        toast.success("Attempt created");
                        return;
                      }

                      // Custom one-off scenario
                      if (!selectedPersona) {
                        toast.error("Select a persona");
                        return;
                      }

                      const name = `Custom Practice - ${selectedPersona.name}`;
                      const filteredParamIds = (
                        parameterItems as ParameterItem[]
                      )
                        .filter((pi) => !pi.defaultItem)
                        .map((pi) => pi.id)
                        .filter((id) => selectedParameterItemIds.includes(id));

                      const newScenario = (await createScenario({
                        name,
                        description: "",
                        personaId: selectedPersona.id,
                        parameterItemIds: filteredParamIds,
                        practiceScenario: true,
                        defaultScenario: false,
                        generated: true,
                        active: true,
                      } as unknown as typeof import("@/utils/drizzle/schema").scenarios.$inferInsert)) as unknown as import("@/types").Scenario;

                      if (!newScenario || !newScenario.id) {
                        toast.error("Failed to create scenario");
                        return;
                      }
                      const newScenarioId = newScenario.id;

                      // Find base default practice scenario for this persona
                      const baseScenario = (scenarios as Scenario[]).find(
                        (s) =>
                          s.personaId === selectedPersona.id &&
                          s.defaultScenario === true &&
                          s.practiceScenario === true
                      );

                      // Find simulation that includes the base scenario (prefer default+practice)
                      const targetSimulation =
                        (simulations as Simulation[]).find(
                          (sim) =>
                            (sim.scenarioIds || []).includes(
                              baseScenario?.id || ""
                            ) &&
                            sim.defaultSimulation === true &&
                            sim.practiceSimulation === true
                        ) ||
                        (simulations as Simulation[]).find((sim) =>
                          (sim.scenarioIds || []).includes(
                            baseScenario?.id || ""
                          )
                        );

                      if (!targetSimulation) {
                        toast.error("No practice simulation found for persona");
                        return;
                      }

                      const attempt = (await createSimulationAttempt({
                        simulationId: targetSimulation.id,
                        profileId: effectiveProfile?.id,
                        infiniteMode: false,
                      } as unknown as typeof import("@/utils/drizzle/schema").simulationAttempts.$inferInsert)) as unknown as import("@/types").SimulationAttempt;
                      if (!attempt || !attempt.id) {
                        toast.error("Failed to create attempt");
                        return;
                      }
                      const attemptIdCreated = attempt.id;

                      await createSimulationChat({
                        title: name,
                        scenarioId: newScenarioId,
                        attemptId: attemptIdCreated,
                        completed: false,
                      } as unknown as typeof import("@/utils/drizzle/schema").simulationChats.$inferInsert);

                      setCustomizeOpen(false);
                      router.push(`/practice/a/${attemptIdCreated}`);
                      toast.success("Custom scenario attempt created");
                    } catch (err) {
                      logError("Failed to create attempt", err);
                      toast.error("Failed to create attempt");
                    }
                  }}
                >
                  Start
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
              setPendingFiles((prev) => prev.filter((f) => f.name !== fileName))
            }
          />
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
